import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn() }
}));

import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const request = new Request("https://eventcore.app/api/test", {
  headers: { "x-forwarded-for": "203.0.113.9" }
});

describe("distributed API rate limiting", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows requests within the configured limit", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { requestCount: 3, expiresAt: new Date(Date.now() + 60_000) }
    ]);

    await expect(
      enforceRateLimit(request, { scope: "test", limit: 3, windowMs: 60_000 })
    ).resolves.toBeNull();
  });

  it("returns 429 and Retry-After after the limit is exceeded", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { requestCount: 4, expiresAt: new Date(Date.now() + 60_000) }
    ]);

    const response = await enforceRateLimit(request, {
      scope: "test",
      limit: 3,
      windowMs: 60_000
    });

    expect(response?.status).toBe(429);
    expect(Number(response?.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("keeps critical routes available with an in-memory limit when the database is unavailable", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(
      new Error("rate-limit table unavailable")
    );

    await expect(
      enforceRateLimit(request, {
        scope: "database-fallback-test",
        limit: 3,
        windowMs: 60_000
      })
    ).resolves.toBeNull();
  });
});
