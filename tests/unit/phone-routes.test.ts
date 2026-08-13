import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    vendor: { create: vi.fn(), update: vi.fn() },
    client: { create: vi.fn(), findFirst: vi.fn() },
    activityLog: { create: vi.fn() },
    // The clients route writes inside a transaction, so the callback has to be
    // run against the same mocked delegates.
    $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run(prisma))
  };

  return {
    prisma,
    requirePermission: vi.fn(),
    requireAnyPermission: vi.fn()
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
// Keep the real AuthorizationError: createApiErrorResponse does an
// `instanceof` check against it, so a bare stub breaks the error path.
vi.mock("@/lib/auth/server-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/server-auth")>()),
  requirePermission: mocks.requirePermission,
  requireAnyPermission: mocks.requireAnyPermission
}));

import { POST as createVendor } from "@/app/api/vendors/route";
import { POST as createClient } from "@/app/api/clients/route";

const organizationId = "33333333-3333-4333-8333-333333333333";
const actor = { id: "user-1", organizationId };

function postVendor(body: Record<string, unknown>) {
  return createVendor(
    new Request("http://localhost/api/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Blooms", category: "Florist", ...body })
    })
  );
}

function postClient(body: Record<string, unknown>) {
  return createClient(
    new Request("http://localhost/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Jordan Rivera", ...body })
    })
  );
}

/**
 * These go through the real route handlers rather than the schema alone,
 * because the reported defect was that the server "gladly accepted" whatever
 * the form sent. Proving the schema rejects a value is not the same as proving
 * the route is wired to it.
 */
describe("phone validation at the route boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(actor);
    mocks.requireAnyPermission.mockResolvedValue(actor);
    mocks.prisma.vendor.create.mockResolvedValue({ id: "vendor-1" });
    mocks.prisma.client.create.mockResolvedValue({
      id: "client-1",
      name: "Jordan Rivera"
    });
    mocks.prisma.client.findFirst.mockResolvedValue(null);
    mocks.prisma.activityLog.create.mockResolvedValue({ id: "log-1" });
  });

  describe("POST /api/vendors", () => {
    it("refuses letters instead of writing them to the database", async () => {
      const response = await postVendor({ phone: "call me maybe" });

      expect(response.status).toBe(400);
      expect(mocks.prisma.vendor.create).not.toHaveBeenCalled();
    });

    it("names the field so the client can show a usable message", async () => {
      const response = await postVendor({ phone: "call me maybe" });
      const body = await response.json();

      expect(body.error).toContain("Vendor phone");
    });

    it("refuses a number that is well-formed but not real", async () => {
      // Right length, right shape, reserved for fiction.
      const response = await postVendor({ phone: "+1 555 010 8899" });

      expect(response.status).toBe(400);
      expect(mocks.prisma.vendor.create).not.toHaveBeenCalled();
    });

    it("stores an accepted number in E.164 whatever the client sent", async () => {
      const response = await postVendor({ phone: "(212) 555-0142" });

      expect(response.status).toBe(201);
      expect(mocks.prisma.vendor.create.mock.calls[0][0].data).toMatchObject({
        phone: "+12125550142"
      });
    });

    it("still allows a vendor with no phone at all", async () => {
      const response = await postVendor({});

      expect(response.status).toBe(201);
      expect(mocks.prisma.vendor.create).toHaveBeenCalled();
    });
  });

  describe("POST /api/clients", () => {
    it("refuses a phone that is not a real number", async () => {
      const response = await postClient({ phone: "abcdefghij" });

      expect(response.status).toBe(400);
      expect(mocks.prisma.client.create).not.toHaveBeenCalled();
    });

    it("normalizes every spelling of one line to a single stored string", async () => {
      // Two spellings of one number must not become two client records.
      await postClient({ phone: "+63 917 123 4567" });
      await postClient({ phone: "+639171234567" });

      const stored = mocks.prisma.client.create.mock.calls.map(
        (call) => call[0].data.phone
      );

      expect(stored).toEqual(["+639171234567", "+639171234567"]);
    });

    it("refuses a national number that carries no country", async () => {
      // Documents the wire contract: forms send E.164 because they know which
      // country was picked. A bare "09171234567" is read against the server
      // default, where it is not a real number - so it is rejected rather than
      // guessed at.
      const response = await postClient({ phone: "09171234567" });

      expect(response.status).toBe(400);
      expect(mocks.prisma.client.create).not.toHaveBeenCalled();
    });
  });
});
