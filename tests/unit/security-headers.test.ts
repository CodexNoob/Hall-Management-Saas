import { describe, expect, it } from "vitest";
import nextConfig, { createContentSecurityPolicy } from "@/next.config";

describe("global security headers", () => {
  it("defines CSP, HSTS, framing, MIME, referrer, and permissions policies", async () => {
    const rules = await nextConfig.headers?.();
    const globalRule = rules?.find((rule) => rule.source === "/(.*)");
    const headers = new Map(
      globalRule?.headers.map(({ key, value }) => [key, value])
    );

    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
  });

  it("allows React Refresh evaluation only outside production", () => {
    expect(createContentSecurityPolicy(false)).toContain("'unsafe-eval'");
    expect(createContentSecurityPolicy(true)).not.toContain("'unsafe-eval'");
  });
});
