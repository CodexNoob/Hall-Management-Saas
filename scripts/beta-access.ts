/**
 * The beta approval mechanism.
 *
 * DELIBERATELY NOT AN ENDPOINT, and not an admin screen either. There is no
 * platform-level administration area in this codebase to put one in: every role
 * lives in `principal_roles` and carries an `organizationId`, and a beta
 * applicant belongs to no organization - so no existing permission could guard
 * an approval UI, and building one would mean inventing a cross-tenant
 * superuser, a permanent new privilege axis far larger than this feature.
 *
 * Instead this runs against DATABASE_URL, which means the people who can
 * approve are exactly the people who already hold production database
 * credentials. There is no route to find and no token to leak.
 *
 *   npm run beta:list
 *   npm run beta:list -- --status=APPROVED
 *   npm run beta:approve -- someone@example.com --by="Your Name"
 *   npm run beta:reject  -- someone@example.com --by="Your Name" --notes="reason"
 *
 * Approving CREATES NOTHING. It flips one column; the organization, owner
 * membership, founding role and free trial are still provisioned by the
 * existing sign-in path the first time the approved person signs in. That is
 * what keeps this script out of the tenant-creation business entirely.
 *
 * See docs/beta-access.md.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { existsSync, readFileSync } from "node:fs";

/**
 * Env loading and the Supabase connection quirk, copied from prisma/seed.ts
 * rather than imported: this file runs standalone through tsx, outside Next's
 * module resolution, exactly as the seed does.
 */
function loadEnvFile(path: string) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/);
    if (!match) continue;

    process.env[match[1].trim()] ??= match[2].trim().replace(/^"(.*)"$/, "$1");
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const VALID_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
type Status = (typeof VALID_STATUSES)[number];

function usage(): never {
  console.error(
    [
      "Usage:",
      "  tsx scripts/beta-access.ts list [--status=PENDING|APPROVED|REJECTED]",
      "  tsx scripts/beta-access.ts approve <email> [--by=name] [--notes=text]",
      "  tsx scripts/beta-access.ts reject  <email> [--by=name] [--notes=text]"
    ].join("\n")
  );
  process.exit(1);
}

function readFlag(argv: string[], name: string) {
  const prefix = `--${name}=`;
  const match = argv.find((argument) => argument.startsWith(prefix));

  return match ? match.slice(prefix.length).trim() || null : null;
}

function normalizeEmail(email: string) {
  // The same normalization the application writes with. A mismatch here would
  // silently approve nobody - the UPDATE would match zero rows and the
  // applicant would keep being refused with nothing to explain it.
  return email.trim().toLowerCase();
}

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const url = new URL(databaseUrl);

  // Supabase's pooled connection string needs this; without it the client fails
  // to connect rather than falling back to something slower.
  if (
    url.searchParams.get("sslmode") === "require" &&
    !url.searchParams.has("uselibpqcompat")
  ) {
    url.searchParams.set("uselibpqcompat", "true");
  }

  return url.toString();
}

function createPrisma() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: getDatabaseUrl() })
  });
}

async function list(prisma: PrismaClient, status: string | null) {
  if (status && !VALID_STATUSES.includes(status as Status)) {
    console.error(`Unknown status "${status}".`);
    process.exit(1);
  }

  const rows = await prisma.betaAccessRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { requestedAt: "asc" },
    select: {
      email: true,
      status: true,
      signupMethod: true,
      requestedAt: true,
      notifiedAt: true,
      decidedBy: true,
      notes: true
    }
  });

  if (rows.length === 0) {
    console.log(status ? `No ${status} requests.` : "No requests.");
    return;
  }

  for (const row of rows) {
    console.log(
      [
        row.status.padEnd(8),
        row.email.padEnd(40),
        (row.signupMethod ?? "-").padEnd(15),
        row.requestedAt.toISOString(),
        row.notifiedAt ? "notified" : "not-notified",
        row.decidedBy ? `by ${row.decidedBy}` : "",
        row.notes ? `- ${row.notes}` : ""
      ]
        .join(" ")
        .trimEnd()
    );
  }

  console.log(`\n${rows.length} request(s).`);
}

async function decide(
  prisma: PrismaClient,
  status: Extract<Status, "APPROVED" | "REJECTED">,
  email: string | undefined,
  decidedBy: string | null,
  notes: string | null
) {
  if (!email || email.startsWith("--")) usage();

  const normalized = normalizeEmail(email);
  const existing = await prisma.betaAccessRequest.findUnique({
    where: { email: normalized },
    select: { status: true }
  });

  if (!existing) {
    // Not created here, on purpose. Inventing a request for an address that
    // never registered would let somebody be "approved" before Supabase has any
    // identity for them - and approving a misspelled address would look like it
    // had worked.
    console.error(
      `No beta access request for ${normalized}. They have to register first.`
    );
    process.exit(1);
  }

  const updated = await prisma.betaAccessRequest.update({
    where: { email: normalized },
    data: {
      status,
      decidedAt: new Date(),
      decidedBy: decidedBy ?? "script",
      ...(notes ? { notes } : {})
    },
    select: { email: true, status: true }
  });

  console.log(
    `${updated.email} is now ${updated.status} (was ${existing.status}).`
  );

  if (status === "APPROVED") {
    console.log(
      "They can sign in now. The organization, owner membership and free trial are created on their first sign-in, as before."
    );
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const prisma = createPrisma();

  try {
    if (command === "list") {
      await list(prisma, readFlag(rest, "status"));
      return;
    }

    if (command === "approve" || command === "reject") {
      await decide(
        prisma,
        command === "approve" ? "APPROVED" : "REJECTED",
        rest[0],
        readFlag(rest, "by"),
        readFlag(rest, "notes")
      );
      return;
    }

    usage();
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
