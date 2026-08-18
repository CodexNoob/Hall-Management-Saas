import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  createSignedUrls: vi.fn(),
  from: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: vi.fn(() => ({
    storage: { from: storageMocks.from }
  }))
}));
vi.mock("@/lib/auth/server-auth", () => ({
  AuthorizationError: class AuthorizationError extends Error {
    status = 403;
  },
  requirePermission: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    menuItem: { findMany: vi.fn(), create: vi.fn() },
    eventPackage: { findMany: vi.fn() },
    addOn: { findMany: vi.fn(), create: vi.fn() },
    menuCategory: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() }
  }
}));

import { GET, POST } from "@/app/api/menu/route";
import { requirePermission } from "@/lib/auth/server-auth";
import { prisma } from "@/lib/prisma";
import { MENU_IMAGE_BUCKET } from "@/lib/storage/buckets";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherOrganizationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const actor = {
  id: "22222222-2222-4222-8222-222222222222",
  organizationId
};

function menuRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/menu", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

function libraryItem(overrides: Record<string, unknown> = {}) {
  return {
    resource: "item",
    name: "Roasted chicken",
    category: "Main",
    // The business segment. This used to read "Library", which was a service
    // style in a column that never meant service style - the two now have
    // separate homes, and "Library" is expressed as sending no `services`.
    usageType: "Both",
    kind: "Food",
    ...overrides
  };
}

describe("menu item pictures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.from.mockReturnValue({
      createSignedUrls: storageMocks.createSignedUrls
    });
    storageMocks.createSignedUrls.mockResolvedValue({ data: [], error: null });
    vi.mocked(requirePermission).mockResolvedValue(actor as never);
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.eventPackage.findMany).mockResolvedValue([]);
    vi.mocked(prisma.addOn.findMany).mockResolvedValue([]);
    vi.mocked(prisma.menuCategory.findMany).mockResolvedValue([]);
    // Creating an item now resolves its category to a real row, creating that
    // course the first time a dish is filed under it.
    vi.mocked(prisma.menuCategory.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.menuCategory.create).mockResolvedValue({
      id: "category-1"
    } as never);
    vi.mocked(prisma.menuItem.create).mockResolvedValue({ id: "1" } as never);
    vi.mocked(prisma.addOn.create).mockResolvedValue({ id: "1" } as never);
  });

  it("rejects a picture path belonging to another tenant", async () => {
    const response = await POST(
      menuRequest(
        libraryItem({ picturePath: `${otherOrganizationId}/menu/stolen.jpg` })
      )
    );

    expect(response.status).toBe(400);
    expect(prisma.menuItem.create).not.toHaveBeenCalled();
  });

  it("rejects traversal in a picture path", async () => {
    for (const picturePath of [
      `${organizationId}/menu/../../secrets.jpg`,
      `${organizationId}/menu\\secrets.jpg`
    ]) {
      const response = await POST(menuRequest(libraryItem({ picturePath })));
      expect(response.status).toBe(400);
    }

    expect(prisma.menuItem.create).not.toHaveBeenCalled();
  });

  it("stores the bucket from the server and ignores one supplied by the client", async () => {
    const picturePath = `${organizationId}/menu/abc.jpg`;
    const response = await POST(
      menuRequest(
        libraryItem({ picturePath, pictureBucket: "event-files" })
      )
    );

    expect(response.status).toBe(201);
    expect(prisma.menuItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          picturePath,
          pictureBucket: MENU_IMAGE_BUCKET
        })
      })
    );
  });

  it("leaves both picture columns empty when no picture is sent", async () => {
    const response = await POST(menuRequest(libraryItem()));

    expect(response.status).toBe(201);
    expect(prisma.menuItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          picturePath: undefined,
          pictureBucket: null
        })
      })
    );
  });

  it("signs every picture in one call and never returns the raw path", async () => {
    const picturePath = `${organizationId}/menu/abc.jpg`;
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([
      { id: "1", name: "With picture", picturePath },
      { id: "2", name: "Without picture", picturePath: null }
    ] as never);
    storageMocks.createSignedUrls.mockResolvedValue({
      data: [
        { error: null, path: picturePath, signedUrl: "https://signed.example/abc" }
      ],
      error: null
    });

    const response = await GET(new Request("http://localhost/api/menu"));
    const payload = await response.json();

    expect(storageMocks.createSignedUrls).toHaveBeenCalledTimes(1);
    expect(storageMocks.createSignedUrls).toHaveBeenCalledWith(
      [picturePath],
      expect.any(Number)
    );
    expect(storageMocks.from).toHaveBeenCalledWith(MENU_IMAGE_BUCKET);
    expect(payload.items[0].pictureUrl).toBe("https://signed.example/abc");
    expect(payload.items[1].pictureUrl).toBeNull();
    expect(payload.items[0]).not.toHaveProperty("picturePath");
    expect(payload.items[0]).not.toHaveProperty("pictureBucket");
  });

  it("skips signing entirely when no item has a picture", async () => {
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([
      { id: "1", name: "Without picture", picturePath: null }
    ] as never);

    const response = await GET(new Request("http://localhost/api/menu"));

    expect(response.status).toBe(200);
    expect(storageMocks.from).not.toHaveBeenCalled();
  });

  it("still serves the menu when signing fails", async () => {
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([
      { id: "1", name: "With picture", picturePath: `${organizationId}/menu/abc.jpg` }
    ] as never);
    storageMocks.createSignedUrls.mockRejectedValue(new Error("storage down"));

    const response = await GET(new Request("http://localhost/api/menu"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].pictureUrl).toBeNull();
  });
});

function addOnBody(overrides: Record<string, unknown> = {}) {
  return {
    resource: "addon",
    name: "Chocolate fountain",
    price: 250,
    pricingType: "fixed",
    hallIds: [],
    ...overrides
  };
}

describe("add-on pictures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.from.mockReturnValue({
      createSignedUrls: storageMocks.createSignedUrls
    });
    storageMocks.createSignedUrls.mockResolvedValue({ data: [], error: null });
    vi.mocked(requirePermission).mockResolvedValue(actor as never);
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.eventPackage.findMany).mockResolvedValue([]);
    vi.mocked(prisma.addOn.findMany).mockResolvedValue([]);
    vi.mocked(prisma.menuCategory.findMany).mockResolvedValue([]);
    vi.mocked(prisma.addOn.create).mockResolvedValue({ id: "1" } as never);
  });

  // The path check is hoisted above the resource branches, so an add-on has to
  // be refused on exactly the paths a library item is.
  it("refuses a path from another tenant or one that traverses", async () => {
    for (const picturePath of [
      `${otherOrganizationId}/menu/stolen.jpg`,
      `${organizationId}/menu/../../secrets.jpg`,
      `${organizationId}/menu\\secrets.jpg`
    ]) {
      const response = await POST(menuRequest(addOnBody({ picturePath })));
      expect(response.status).toBe(400);
    }

    expect(prisma.addOn.create).not.toHaveBeenCalled();
  });

  it("stores the bucket from the server and ignores one supplied by the client", async () => {
    const picturePath = `${organizationId}/menu/addon.jpg`;
    const response = await POST(
      menuRequest(addOnBody({ picturePath, pictureBucket: "event-files" }))
    );

    expect(response.status).toBe(201);
    expect(prisma.addOn.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          picturePath,
          pictureBucket: MENU_IMAGE_BUCKET
        })
      })
    );
  });

  it("leaves both picture columns empty when no picture is sent", async () => {
    const response = await POST(menuRequest(addOnBody()));

    expect(response.status).toBe(201);
    expect(prisma.addOn.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          picturePath: undefined,
          pictureBucket: null
        })
      })
    );
  });

  it("signs add-on and item pictures together and never returns the raw path", async () => {
    const itemPath = `${organizationId}/menu/item.jpg`;
    const addOnPath = `${organizationId}/menu/addon.jpg`;
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([
      { id: "1", name: "With picture", picturePath: itemPath }
    ] as never);
    vi.mocked(prisma.addOn.findMany).mockResolvedValue([
      { id: "2", name: "With picture", picturePath: addOnPath },
      { id: "3", name: "Without picture", picturePath: null }
    ] as never);
    storageMocks.createSignedUrls.mockResolvedValue({
      data: [
        { error: null, path: itemPath, signedUrl: "https://signed.example/item" },
        { error: null, path: addOnPath, signedUrl: "https://signed.example/addon" }
      ],
      error: null
    });

    const response = await GET(new Request("http://localhost/api/menu"));
    const payload = await response.json();

    // One call for the whole page, not one per resource.
    expect(storageMocks.createSignedUrls).toHaveBeenCalledTimes(1);
    expect(storageMocks.createSignedUrls).toHaveBeenCalledWith(
      [itemPath, addOnPath],
      expect.any(Number)
    );
    expect(payload.items[0].pictureUrl).toBe("https://signed.example/item");
    expect(payload.addOns[0].pictureUrl).toBe("https://signed.example/addon");
    expect(payload.addOns[1].pictureUrl).toBeNull();
    expect(payload.addOns[0]).not.toHaveProperty("picturePath");
    expect(payload.addOns[0]).not.toHaveProperty("pictureBucket");
  });

  it("signs an add-on picture even when no item has one", async () => {
    const addOnPath = `${organizationId}/menu/addon.jpg`;
    vi.mocked(prisma.addOn.findMany).mockResolvedValue([
      { id: "1", name: "With picture", picturePath: addOnPath }
    ] as never);
    storageMocks.createSignedUrls.mockResolvedValue({
      data: [
        { error: null, path: addOnPath, signedUrl: "https://signed.example/addon" }
      ],
      error: null
    });

    const response = await GET(new Request("http://localhost/api/menu"));
    const payload = await response.json();

    expect(payload.addOns[0].pictureUrl).toBe("https://signed.example/addon");
  });
});
