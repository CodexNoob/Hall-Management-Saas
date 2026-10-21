import fs from "node:fs/promises";
import path from "node:path";
import { createHmac } from "node:crypto";
import { expect, test as setup } from "@playwright/test";
import { waitForHydration } from "./hydration";

const authDirectory = path.resolve("playwright/.auth");
const MFA_DIALOG_TITLE = "Two-factor authentication";

function base32Decode(input: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = input
    .replace(/[\s=-]/g, "")
    .toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of normalized) {
    const index = alphabet.indexOf(char);

    if (index === -1) {
      throw new Error("TOTP secret must be base32 encoded.");
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function totp(secret: string, at = Date.now()) {
  const counter = Math.floor(at / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret))
    .update(message)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, "0");
}

async function maybeCompleteMfa(
  page: import("@playwright/test").Page,
  email: string,
  totpSecret?: string
) {
  const dialog = page.getByRole("dialog", { name: MFA_DIALOG_TITLE });

  // Whichever comes first: the dashboard (no code owed) or the 2FA dialog.
  // The sign-in form asks the SERVER whether a code is owed before it opens the
  // dialog - a trusted device may not owe one - and that /api/auth/session
  // call makes several Supabase round trips (more on a cold or reused dev
  // server), so a short fixed wait gave up before the dialog appeared and the
  // code was never entered. Each branch swallows its own timeout so the loser
  // cannot reject unhandled.
  const outcome = await Promise.race([
    dialog
      .waitFor({ state: "visible", timeout: 45_000 })
      .then(() => "mfa" as const)
      .catch(() => null),
    page
      .waitForURL(/\/dashboard/, { timeout: 45_000 })
      .then(() => "dashboard" as const)
      .catch(() => null)
  ]);

  if (outcome !== "mfa") return;

  if (!totpSecret) {
    throw new Error(
      [
        `Signing in as ${email} requires 2FA.`,
        "Set the matching E2E_*_TOTP_SECRET environment variable for this test account,",
        "or use a dedicated E2E account without MFA for the broad suite."
      ].join(" ")
    );
  }

  const codeInput = dialog.getByLabel("Authentication code");
  const verify = dialog.getByRole("button", { name: "Verify" });

  await codeInput.fill(totp(totpSecret));
  await verify.click();

  try {
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  } catch {
    // A code generated at the edge of its 30-second window can expire between
    // fill and verify. Try the next window once before surfacing the failure.
    await codeInput.fill(totp(totpSecret, Date.now() + 30_000));
    await verify.click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  }
}

// Authentication includes the initial dev-server compilation, Supabase login,
// user synchronization, dashboard navigation, and storage-state serialization.
// Keep this setup allowance separate from the faster application test budget.
setup.setTimeout(60_000);
setup.describe.configure({ mode: "serial" });

async function authenticate(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
  stateFile: string,
  totpSecret?: string
) {
  await page.addInitScript(() => {
    window.localStorage.removeItem("hms.authSession");
    window.localStorage.removeItem("hms.authSession.subject");
    window.localStorage.removeItem("hms.authSession.fetchedAt");
    window.sessionStorage.removeItem("hms.authSession");
  });

  await page.goto("/login");
  // The login markup is server-rendered, so the submit button is clickable
  // before React attaches onSubmit. Clicking early performs a native GET
  // submission, which lands back on /login with the credentials in the query
  // string and never reaches Supabase.
  await waitForHydration(page);
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Remember me").check();
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await maybeCompleteMfa(page, email, totpSecret);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });

  const state = await page.context().storageState({ path: stateFile });
  const authCookies = state.cookies.filter((cookie) =>
    // Chunked when the JWT is large: sb-<ref>-auth-token.0, .1, ...
    /^sb-.+-auth-token(\.\d+)?$/.test(cookie.name)
  );

  // Landing on /dashboard is not proof the session persisted. If the auth
  // cookie is written with Secure, the http baseURL drops it, storageState
  // comes out empty, and the failure surfaces later as seven authenticated
  // specs bouncing to the marketing page with no hint about the cause.
  expect(
    authCookies,
    `signed in as ${email} but the context holds no Supabase auth cookie - check Secure/SameSite against the http baseURL`
  ).not.toHaveLength(0);

  // "Remember me" is ticked above, so every one of them must be persistent.
  // A session cookie here (expires === -1) means the remember-me preference
  // never reached the cookie writer.
  for (const cookie of authCookies) {
    expect(
      cookie.expires,
      `${cookie.name} is a session cookie despite "Remember me" being checked`
    ).toBeGreaterThan(0);
  }
}

setup.beforeAll(async () => {
  await fs.mkdir(authDirectory, { recursive: true });
  const emptyState = JSON.stringify({ cookies: [], origins: [] });
  await Promise.all([
    fs.writeFile(path.join(authDirectory, "readonly.json"), emptyState),
    fs.writeFile(path.join(authDirectory, "mutation.json"), emptyState),
    fs.writeFile(path.join(authDirectory, "restricted.json"), emptyState)
  ]);
});

setup("create read-only authenticated state", async ({ page }) => {
  const email = process.env.E2E_READONLY_EMAIL;
  const password = process.env.E2E_READONLY_PASSWORD;
  setup.skip(!email || !password, "Read-only E2E credentials are not set.");

  await authenticate(
    page,
    email!,
    password!,
    path.join(authDirectory, "readonly.json"),
    process.env.E2E_READONLY_TOTP_SECRET
  );
});

setup("create mutation-account authenticated state", async ({ page }) => {
  const email = process.env.E2E_MUTATION_EMAIL;
  const password = process.env.E2E_MUTATION_PASSWORD;
  setup.skip(!email || !password, "Mutation E2E credentials are not set.");

  await authenticate(
    page,
    email!,
    password!,
    path.join(authDirectory, "mutation.json"),
    process.env.E2E_MUTATION_TOTP_SECRET
  );
});

/**
 * The account that holds NOTHING.
 *
 * rbac-enforcement.mutation.spec.ts needs a principal whose effective set is
 * empty, so that a 200 from any guarded endpoint proves the grant that test just
 * made rather than something the account already carried. That is the whole
 * value of the account: it is the control in the experiment.
 *
 * It must be a real, active member of the same organization as the mutation
 * account and hold no role at all. A stranger would be refused by provisioning
 * with `InvitationRequiredError` long before any permission check, which looks
 * identical to a working guard from the outside and would make the suite pass
 * for the wrong reason.
 *
 * Signing in with no permissions still lands on /dashboard - the layout guard
 * renders "Access restricted" in place rather than redirecting - so the shared
 * `authenticate` helper's URL wait holds without special-casing.
 */
setup("create restricted-account authenticated state", async ({ page }) => {
  const email = process.env.E2E_RESTRICTED_EMAIL;
  const password = process.env.E2E_RESTRICTED_PASSWORD;
  setup.skip(!email || !password, "Restricted E2E credentials are not set.");

  await authenticate(
    page,
    email!,
    password!,
    path.join(authDirectory, "restricted.json"),
    process.env.E2E_RESTRICTED_TOTP_SECRET
  );
});
