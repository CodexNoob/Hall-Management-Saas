import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server-auth", () => ({ requirePermission: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    menuItem: { create: vi.fn() },
    activityLog: { create: vi.fn() },
    $transaction: vi.fn()
  }
}));

import { POST } from "@/app/api/menu/import/route";
import { MAX_MENU_CSV_ROWS } from "@/features/menu/lib/menu-csv";
import { AuthorizationError } from "@/lib/auth/errors";
import { requirePermission } from "@/lib/auth/server-auth";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherOrganizationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const actor = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Dana Klein",
  organizationId
};

function importRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/menu/import", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/** The shape the dialog sends: the CSV columns plus the fields it fills in. */
function item(overrides: Record<string, unknown> = {}) {
  return {
    name: "Roasted chicken",
    category: "Main",
    usageType: "Both",
    kind: "Food",
    kosherType: "Fleishig",
    allergens: ["sesame"],
    notes: "Slow roasted",
    ...overrides
  };
}

/** The `data` argument of the nth `menuItem.create` the transaction built. */
function createdData(callIndex = 0) {
  return vi.mocked(prisma.menuItem.create).mock.calls[callIndex]?.[0]?.data as
    | Record<string, unknown>
    | undefined;
}

describe("POST /api/menu/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(enforceRateLimit).mockResolvedValue(null);
    vi.mocked(requirePermission).mockResolvedValue(actor as never);
    vi.mocked(prisma.menuItem.create).mockImplementation((() =>
      Promise.resolve({ id: "created" })) as never);
    vi.mocked(prisma.activityLog.create).mockResolvedValue({} as never);
    vi.mocked(prisma.$transaction).mockImplementation(((
      operations: Promise<unknown>[]
    ) => Promise.all(operations)) as never);
  });

  it("creates one row per item and reports the count", async () => {
    const response = await POST(
      importRequest({ items: [item(), item({ name: "Kugel" })] })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ imported: 2 });
    expect(prisma.menuItem.create).toHaveBeenCalledTimes(2);
    // Written through the transaction, not one loose call at a time - a
    // half-imported sheet is the failure this endpoint is built to avoid.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("writes the parsed columns onto the row", async () => {
    await POST(importRequest({ items: [item()] }));

    expect(createdData()).toMatchObject({
      name: "Roasted chicken",
      category: "Main",
      usageType: "Both",
      kind: "Food",
      kosherType: "Fleishig",
      allergens: ["sesame"],
      notes: "Slow roasted"
    });
  });

  it("takes the organization from the actor, never from the body", async () => {
    await POST(
      importRequest({
        items: [item({ organizationId: otherOrganizationId })]
      })
    );

    expect(createdData()).toMatchObject({ organizationId });
  });

  it("stamps the actor's organization on the nested service rows too", async () => {
    await POST(
      importRequest({
        items: [
          item({
            services: [
              {
                serviceStyle: "Buffet",
                quantity: 1,
                unit: "tray",
                per: 30,
                perBasis: "TotalGuests",
                rounding: "Up",
                minimumUnits: null
              }
            ]
          })
        ]
      })
    );

    expect(createdData()?.services).toEqual({
      create: [
        expect.objectContaining({ organizationId, serviceStyle: "Buffet" })
      ]
    });
  });

  it("ignores a picture path, which this endpoint does not accept", async () => {
    await POST(
      importRequest({
        items: [item({ picturePath: `${otherOrganizationId}/menu/stolen.jpg` })]
      })
    );

    // Stripped by the schema rather than stored unchecked: there is no
    // `readPicturePathError` call here because there is nothing to check.
    expect(createdData()).not.toHaveProperty("picturePath");
  });

  it("defaults a missing allergen list to an empty array", async () => {
    await POST(importRequest({ items: [item({ allergens: undefined })] }));

    expect(createdData()).toMatchObject({ allergens: [] });
  });

  it("records the import in the activity log", async () => {
    await POST(importRequest({ items: [item(), item({ name: "Kugel" })] }));

    expect(prisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        userId: actor.id,
        actionType: "Menu Items Imported",
        newValue: { count: 2 }
      })
    });
  });

  describe("refusals", () => {
    it("refuses a caller without canEditMenu", async () => {
      vi.mocked(requirePermission).mockRejectedValue(
        new AuthorizationError(403, "You do not have permission.")
      );

      const response = await POST(importRequest({ items: [item()] }));

      expect(response.status).toBe(403);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("checks the permission it needs", async () => {
      await POST(importRequest({ items: [item()] }));

      expect(requirePermission).toHaveBeenCalledWith(
        expect.anything(),
        "canEditMenu"
      );
    });

    it("returns the rate limiter's response without writing", async () => {
      vi.mocked(enforceRateLimit).mockResolvedValue(
        new Response(null, { status: 429 }) as never
      );

      const response = await POST(importRequest({ items: [item()] }));

      expect(response.status).toBe(429);
      expect(requirePermission).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("refuses a file longer than the cap the dialog enforces", async () => {
      const items = Array.from({ length: MAX_MENU_CSV_ROWS + 1 }, (_u, index) =>
        item({ name: `Dish ${index}` })
      );

      const response = await POST(importRequest({ items }));

      expect(response.status).toBe(400);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("refuses an empty import", async () => {
      const response = await POST(importRequest({ items: [] }));

      expect(response.status).toBe(400);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("refuses an item the single-create endpoint would also refuse", async () => {
      const response = await POST(
        importRequest({ items: [item({ kosherType: "Halal" })] })
      );

      expect(response.status).toBe(400);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("refuses an item with no name", async () => {
      const response = await POST(
        importRequest({ items: [item({ name: "" })] })
      );

      expect(response.status).toBe(400);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
