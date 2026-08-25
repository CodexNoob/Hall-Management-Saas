import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Re-export the real AuthorizationError: createApiErrorResponse maps it to a
// 403 with `instanceof`, so a look-alike class defined here would fall through
// to a 500 and the permission assertion below would pass for the wrong reason.
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorize: vi.fn(),
  // The door asks for `settings.read`; the branches that reach further ask
  // again through this. Whether the resolver answers correctly is a different
  // suite's question.
  assertPermission: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: { findUniqueOrThrow: vi.fn() },
    organizationSetting: { upsert: vi.fn() },
    notificationPreference: { upsert: vi.fn() },
    // Every hall gets the organization-wide daily event limit written to it in
    // the same transaction.
    hall: { updateMany: vi.fn() },
    paymentSetting: { findUnique: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn()
  }
}));

import { GET, PATCH } from "@/app/api/settings/route";
import { AuthorizationError } from "@/lib/auth/errors";
import { assertPermission, authorize } from "@/lib/authz/authorize";
import { prisma } from "@/lib/prisma";
import { authzContext } from "./authz-test-helpers";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const actorId = "22222222-2222-4222-8222-222222222222";

function patch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}

describe("organization payment link settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorize).mockResolvedValue(
      authzContext({ organizationId, userId: actorId })
    );
    vi.mocked(assertPermission).mockResolvedValue(undefined);
    vi.mocked(prisma.organization.findUniqueOrThrow).mockResolvedValue({
      id: organizationId,
      name: "Venue A"
    } as never);
    vi.mocked(prisma.organizationSetting.upsert).mockResolvedValue({
      integrations: null
    } as never);
    vi.mocked(prisma.notificationPreference.upsert).mockResolvedValue(
      {} as never
    );
    vi.mocked(prisma.paymentSetting.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.paymentSetting.upsert).mockResolvedValue({
      paymentLink: "https://secure.example.com/venue-a"
    } as never);
    // The route takes the interactive form and destructures a named object
    // from it. Resolving to a two-element array left `settings` undefined and
    // the handler crashed reading `.integrations` off it - a 500 the test
    // reported only as "expected 500 to be 200". Running the callback against
    // the same delegates keeps the assertions below pointed at real writes.
    vi.mocked(prisma.$transaction).mockImplementation((async (
      run: (transaction: typeof prisma) => unknown
    ) => run(prisma)) as never);
  });

  it("returns the calling organization's payment link", async () => {
    vi.mocked(prisma.paymentSetting.findUnique).mockResolvedValue({
      paymentLink: "https://secure.example.com/venue-a"
    } as never);

    const response = await GET(new Request("http://localhost/api/settings"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.payments).toEqual({
      paymentLink: "https://secure.example.com/venue-a"
    });
    expect(prisma.paymentSetting.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId } })
    );
  });

  it("reports an unconfigured organization as an empty link", async () => {
    const response = await GET(new Request("http://localhost/api/settings"));
    const body = await response.json();

    expect(body.payments).toEqual({ paymentLink: "" });
  });

  it("requires the payments permission to change the link", async () => {
    // Getting through the settings door is not enough: redirecting where money
    // lands is its own decision, asked separately.
    vi.mocked(assertPermission).mockImplementation((async (
      _context: unknown,
      permission: string
    ) => {
      if (permission === "payment.record") {
        throw new AuthorizationError(403, "You do not have permission.");
      }
    }) as never);

    const response = await patch({
      payments: { paymentLink: "https://secure.example.com/venue-a" }
    });

    expect(response.status).toBe(403);
    expect(prisma.paymentSetting.upsert).not.toHaveBeenCalled();
  });

  it("upserts against the actor's organization, ignoring any body-supplied id", async () => {
    const response = await patch({
      payments: { paymentLink: "https://secure.example.com/venue-a" }
    });

    expect(response.status).toBe(200);
    expect(assertPermission).toHaveBeenCalledWith(
      expect.anything(),
      "payment.record"
    );
    expect(prisma.paymentSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId },
        create: expect.objectContaining({ organizationId })
      })
    );
  });

  it("accepts an empty string to clear the link", async () => {
    vi.mocked(prisma.paymentSetting.upsert).mockResolvedValue({
      paymentLink: ""
    } as never);

    const response = await patch({ payments: { paymentLink: "" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.payments).toEqual({ paymentLink: "" });
  });

  it("rejects a payment link that is not a URL", async () => {
    const response = await patch({ payments: { paymentLink: "not-a-url" } });

    expect(response.status).toBe(400);
    expect(prisma.paymentSetting.upsert).not.toHaveBeenCalled();
  });

  it("does not touch payment settings when the body omits them", async () => {
    const response = await patch({ emailNotifications: false });

    expect(response.status).toBe(200);
    expect(prisma.paymentSetting.upsert).not.toHaveBeenCalled();
    expect(assertPermission).not.toHaveBeenCalledWith(
      expect.anything(),
      "payment.record"
    );
  });
});
