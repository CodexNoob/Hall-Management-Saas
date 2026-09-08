import { beforeEach, describe, expect, it, vi } from "vitest";
import { authzContext } from "@/tests/unit/authz-test-helpers";

const mocks = vi.hoisted(() => ({
  prisma: {
    hall: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    // Written alongside the hall when a daily event limit is set, so the two
    // cannot disagree about the cap.
    organizationSetting: {
      upsert: vi.fn(),
      update: vi.fn()
    },
    // The hall edit records what moved, in the same transaction as the write.
    activityLog: { create: vi.fn() },
    $transaction: vi.fn()
  },
  authorize: vi.fn(),
  // PATCH's door is `hall.update`; the branches that see a price field or a
  // circulation flag ask again for `hall.price.update` / `hall.delete`. Mocked
  // so these tests can drive both answers - the real one would resolve the
  // caller's effective set against a database that is not here.
  assertPermission: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
// Keep the real AuthorizationError: createApiErrorResponse does an
// `instanceof` check against it, so a bare stub breaks the error path.
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorize: mocks.authorize,
  assertPermission: mocks.assertPermission
}));

import { PATCH } from "@/app/api/halls/route";
import { AuthorizationError } from "@/lib/auth/errors";

const organizationId = "11111111-1111-4111-8111-111111111111";
const hallId = "22222222-2222-4222-8222-222222222222";

function patch(body: Record<string, unknown>) {
  return PATCH(
    new Request("http://localhost/api/halls", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: hallId, ...body })
    })
  );
}

describe("PATCH /api/halls numeric validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue(authzContext({ userId: "user-1", organizationId }));
    mocks.assertPermission.mockResolvedValue(undefined);
    mocks.prisma.hall.findFirst.mockResolvedValue({
      id: hallId,
      isActive: true
    });
    mocks.prisma.hall.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: hallId,
        ...data
      })
    );
    mocks.prisma.organizationSetting.upsert.mockResolvedValue({
      integrations: null
    });
    // Runs the callback against the same delegates, so the assertions below
    // still see the writes the route makes inside the transaction. Resolving
    // to a fixed value instead would pass whatever the route did unchecked.
    mocks.prisma.$transaction.mockImplementation(
      async (run: (transaction: typeof mocks.prisma) => unknown) =>
        run(mocks.prisma)
    );
  });

  it("treats null as a deliberate clear and undefined as leave-alone", async () => {
    // The PATCH contract the client depends on: an emptied box sends null,
    // and a field the user never touched is simply absent.
    const response = await patch({ capacity: null, basePrice: null });

    expect(response.status).toBe(200);

    const data = mocks.prisma.hall.update.mock.calls[0][0].data;
    expect(data.capacity).toBeNull();
    expect(data.basePrice).toBeNull();
    expect("perCouplePrice" in data).toBe(false);
  });

  it("rejects a capacity of zero rather than storing it", async () => {
    const response = await patch({ capacity: 0 });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.issues.fieldErrors.capacity).toBeTruthy();
    expect(mocks.prisma.hall.update).not.toHaveBeenCalled();
  });

  it("rejects a fractional capacity", async () => {
    const response = await patch({ capacity: 12.5 });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(
      "Capacity must be a whole number."
    );
  });

  it("rejects a price with more than two decimal places", async () => {
    const response = await patch({ basePrice: 10.005 });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Base price can have at most 2 decimal places.");
    expect(mocks.prisma.hall.update).not.toHaveBeenCalled();
  });

  it("rejects a numeric field sent as a string", async () => {
    const response = await patch({ basePrice: "10" });

    expect(response.status).toBe(400);
    expect(mocks.prisma.hall.update).not.toHaveBeenCalled();
  });

  it("accepts a well-formed update", async () => {
    const response = await patch({ capacity: 250, basePrice: 1999.5 });

    expect(response.status).toBe(200);

    const data = mocks.prisma.hall.update.mock.calls[0][0].data;
    expect(data.capacity).toBe(250);
    expect(data.basePrice).toBe(1999.5);
  });
});

/**
 * The two decisions PATCH makes past its own door.
 *
 * `hall.update` is "the facts about a hall". Repricing it and taking it out of
 * circulation arrive through the same endpoint and are not that, so each asks
 * again - and the point of asking separately is that the caller who only wanted
 * to fix a capacity is not locked out. These tests pin both halves: the extra
 * key is demanded when the field is present, and NOT demanded when it is
 * absent.
 */
describe("PATCH /api/halls field-level authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue(
      authzContext({ userId: "user-1", organizationId })
    );
    mocks.assertPermission.mockResolvedValue(undefined);
    mocks.prisma.hall.findFirst.mockResolvedValue({ id: hallId, isActive: true });
    mocks.prisma.hall.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: hallId,
        ...data
      })
    );
    mocks.prisma.$transaction.mockImplementation(
      async (run: (transaction: typeof mocks.prisma) => unknown) =>
        run(mocks.prisma)
    );
  });

  function keysAsked() {
    return mocks.assertPermission.mock.calls.map((call) => call[1]);
  }

  it("asks for nothing extra when only ordinary fields move", async () => {
    const response = await patch({ capacity: 250, color: "#123456" });

    expect(response.status).toBe(200);
    expect(keysAsked()).toEqual([]);
  });

  it.each([
    "basePrice",
    "perCouplePrice",
    "memberBasePrice",
    "memberPerCouplePrice"
  ])("asks for hall.price.update when %s is sent", async (field) => {
    await patch({ [field]: 100 });

    expect(keysAsked()).toContain("hall.price.update");
  });

  it.each(["isActive", "isBookable"])(
    "asks for hall.delete when %s is sent",
    async (field) => {
      await patch({ [field]: false });

      expect(keysAsked()).toContain("hall.delete");
    }
  );

  it("refuses the write when the extra key is denied", async () => {
    // Denial has to stop the update, not merely be recorded - the whole reason
    // the check is before the transaction.
    mocks.assertPermission.mockRejectedValue(
      new AuthorizationError(
        403,
        "You do not have permission to perform this action.",
        "not_permitted"
      )
    );

    const response = await patch({ basePrice: 500 });

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("not_permitted");
    expect(mocks.prisma.hall.update).not.toHaveBeenCalled();
  });

  it("clearing a price is still repricing", async () => {
    // `null` means "Not set", which is a price change like any other. Treating
    // only truthy values as pricing would let a caller without the key wipe the
    // rate card.
    await patch({ basePrice: null });

    expect(keysAsked()).toContain("hall.price.update");
  });
});
