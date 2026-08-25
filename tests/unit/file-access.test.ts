import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
  from: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: vi.fn(() => ({
    storage: { from: storageMocks.from }
  }))
}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorize: vi.fn()
}));
vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null)
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fileFolder: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn()
    },
    storedFile: { findMany: vi.fn(), create: vi.fn() },
    // findMany as well as findFirst: the listing now returns a short event
    // list for the Add File dialog's booking picker.
    event: { findFirst: vi.fn(), findMany: vi.fn() },
    client: { findFirst: vi.fn() }
  }
}));

import { GET, POST } from "@/app/api/files/route";
import { authorize } from "@/lib/authz/authorize";
import { prisma } from "@/lib/prisma";
import { createSignedFileUrl } from "@/lib/storage/files";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const actor = {
  id: "22222222-2222-4222-8222-222222222222",
  organizationId
};

describe("file access isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.from.mockReturnValue({
      createSignedUrl: storageMocks.createSignedUrl
    });
    storageMocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.example/signed" },
      error: null
    });
    vi.mocked(authorize).mockResolvedValue(actor as never);
    vi.mocked(prisma.fileFolder.findMany).mockResolvedValue([]);
    vi.mocked(prisma.storedFile.findMany).mockResolvedValue([]);
    vi.mocked(prisma.event.findMany).mockResolvedValue([]);
  });

  it("refuses to sign a path belonging to another tenant", async () => {
    await expect(
      createSignedFileUrl({
        organizationId,
        bucket: "event-files",
        path: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/private.pdf"
      })
    ).rejects.toThrow("scoped to the active organization");
    expect(storageMocks.from).not.toHaveBeenCalled();
  });

  it("scopes file and folder listings to the authenticated organization", async () => {
    const request = new Request("http://localhost/api/files");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(authorize).toHaveBeenCalledWith(
      request,
      "canViewEventManager"
    );
    expect(prisma.fileFolder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId }
      })
    );
    expect(prisma.storedFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId }
      })
    );
    // The booking picker's list is the newest thing this route returns, and it
    // names clients - exactly the sort of list that must not cross tenants.
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId }
      })
    );
  });

  it("rejects file metadata with a cross-tenant storage path", async () => {
    const request = new Request("http://localhost/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource: "file",
        bucket: "event-files",
        storagePath: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/private.pdf",
        fileName: "private.pdf"
      })
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(prisma.storedFile.create).not.toHaveBeenCalled();
  });
});
