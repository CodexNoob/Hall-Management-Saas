import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server-auth", () => ({
  requireAnyPermission: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { client: { findMany: vi.fn() } }
}));

import { GET } from "@/app/api/clients/route";
import { requireAnyPermission } from "@/lib/auth/server-auth";
import { prisma } from "@/lib/prisma";

describe("client tenant isolation", () => {
  const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAnyPermission).mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      organizationId
    } as never);
    vi.mocked(prisma.client.findMany).mockResolvedValue([]);
  });

  it("scopes the client directory to the verified organization", async () => {
    const response = await GET(
      new Request("http://localhost/api/clients", {
        headers: {
          Authorization: "Bearer valid-token",
          "X-Organization-Id": organizationId
        }
      })
    );

    expect(response.status).toBe(200);
    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId } })
    );
  });
});
