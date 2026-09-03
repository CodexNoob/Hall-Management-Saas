/**
 * @vitest-environment node
 *
 * The suite is jsdom-wide (vitest.config.ts:15), and pino ships a SEPARATE
 * browser build with no `redact` and no serializers. Without this pragma every
 * assertion below would pass against a build that redacts nothing, which is the
 * exact failure this file exists to catch.
 */
import { describe, expect, it } from "vitest";
import pino from "pino";
import { redactPaths, safePath } from "@/lib/logging/logger";

function capture() {
  const lines: string[] = [];
  const logger = pino(
    { redact: { paths: redactPaths, censor: "[redacted]" }, base: null },
    { write: (line: string) => void lines.push(line) }
  );

  return { logger, lines };
}

describe("log redaction", () => {
  it("is running against the Node build of pino, not the browser one", () => {
    // If this fails, the @vitest-environment pragma above was lost and every
    // other assertion in this file is vacuous.
    const { logger, lines } = capture();
    logger.info({ password: "hunter2" }, "check");

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("[redacted]");
  });

  it.each([
    ["depth 1", { password: "hunter2" }],
    ["depth 2", { user: { password: "hunter2" } }],
    ["depth 3", { booking: { client: { password: "hunter2" } } }],
    ["depth 4", { a: { booking: { client: { password: "hunter2" } } } }]
  ])("removes a credential nested at %s", (_label, payload) => {
    const { logger, lines } = capture();
    logger.info(payload, "nested");

    expect(lines[0]).not.toContain("hunter2");
  });

  it.each([
    "access_token",
    "refresh_token",
    "tokenHash",
    "client_secret",
    "public_token",
    "email",
    "userEmail",
    "phoneNumber"
  ])("removes %s wherever it sits", (key) => {
    const { logger, lines } = capture();
    logger.info(
      { [key]: "SECRET", nested: { [key]: "SECRET" } },
      "keys"
    );

    expect(lines[0]).not.toContain("SECRET");
  });

  it("keeps the fields that make a line worth having", () => {
    const { logger, lines } = capture();
    logger.info(
      {
        organizationId: "org-1",
        userId: "11111111-2222-3333-4444-555555555555",
        route: "POST /api/events",
        status: 201
      },
      "request_completed"
    );

    expect(lines[0]).toContain("org-1");
    expect(lines[0]).toContain("11111111-2222-3333-4444-555555555555");
    expect(lines[0]).toContain("POST /api/events");
  });
});

describe("safePath", () => {
  it("leaves a path with no query string alone", () => {
    expect(safePath("/api/events")).toBe("/api/events");
  });

  it("strips the one-time credentials the auth links carry", () => {
    const cleaned = safePath("/auth/confirm?token_hash=abc123&type=invite");

    expect(cleaned).not.toContain("abc123");
    expect(cleaned).toContain("type=invite");
  });

  it("strips the PKCE code", () => {
    expect(safePath("/auth/callback?code=xyz789")).not.toContain("xyz789");
  });

  it("uses a censor that survives percent-encoding", () => {
    // `[redacted]` would come back as `%5Bredacted%5D` through
    // URLSearchParams.toString(), and a search for the marker would miss.
    const cleaned = safePath("/auth/confirm?token_hash=abc123");

    expect(cleaned).toContain("REDACTED");
    expect(cleaned).not.toContain("%5B");
  });

  it("leaves unrelated parameters untouched", () => {
    expect(safePath("/api/events?eventId=42")).toBe("/api/events?eventId=42");
  });
});
