/**
 * @vitest-environment node
 *
 * `withRoute` builds on `node:async_hooks` and `node:crypto`, and the assertion
 * that a completion line was actually emitted needs the Node build of pino. The
 * suite is jsdom-wide (vitest.config.ts:15), so without this pragma the scope
 * would not exist and the log assertions would be vacuous.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));
// Not used by anything under test. It arrives transitively through
// `createApiErrorResponse`, which imports the booking service for its
// write-conflict check, and the real client throws on a missing DATABASE_URL at
// import time.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

/**
 * The emitted lines, read back from a real pino instance.
 *
 * Redirecting the destination rather than stubbing `log`: pino writes through
 * sonic-boom straight to fd 1, so a `process.stdout.write` spy sees nothing, and
 * a mocked `log` would assert that a call happened rather than what the line
 * ends up containing. Keeping the real logger keeps redaction and the child
 * bindings in the assertion.
 */
const logLines = vi.hoisted(() => [] as string[]);

vi.mock("@/lib/logging/logger", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/logging/logger")>();
  const { default: pino } = await import("pino");

  return {
    ...actual,
    baseLogger: pino(
      {
        redact: { paths: actual.redactPaths, censor: "[redacted]" },
        base: null,
        formatters: { level: (label: string) => ({ level: label }) }
      },
      { write: (line: string) => void logLines.push(line) }
    )
  };
});

import { bindActor, getRequestId, log } from "@/lib/logging/context";
import { withRoute } from "@/lib/http/with-route";
import { AuthorizationError } from "@/lib/auth/errors";

beforeEach(() => {
  logLines.length = 0;
});

const ok = () => NextResponse.json({ ok: true });

describe("withRoute request ids", () => {
  it("mints one and echoes it on the response", async () => {
    const handler = withRoute("GET /api/halls", async () => ok());
    const response = await handler(new Request("http://localhost/api/halls"));

    expect(response.headers.get("x-request-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("adopts a well-formed inbound id, so one id spans the whole call", async () => {
    const handler = withRoute("GET /api/halls", async () => ok());
    const response = await handler(
      new Request("http://localhost/api/halls", {
        headers: { "x-request-id": "abcd1234-client-minted" }
      })
    );

    expect(response.headers.get("x-request-id")).toBe("abcd1234-client-minted");
  });

  // A literal newline never gets this far - undici rejects it in the `Request`
  // constructor - so the cases below are the ones that do arrive: characters
  // that are legal in a header value but would forge structure in a JSON log
  // line, and lengths outside anything this wrapper would have minted.
  it.each([
    ["a quote and a brace, which would forge JSON", 'abcd1234","evil":"1'],
    ["a tab and a space", "abcd1234\tlevel=error"],
    ["a value too short to have been minted here", "abc"],
    ["a value past the length cap", "a".repeat(65)]
  ])("discards an inbound id carrying %s", async (_label, claimed) => {
    const handler = withRoute("GET /api/halls", async () => ok());
    const response = await handler(
      new Request("http://localhost/api/halls", {
        headers: { "x-request-id": claimed }
      })
    );

    // Replaced outright rather than sanitised: a filtered id would still be
    // attacker-chosen, just quieter about it.
    expect(response.headers.get("x-request-id")).not.toBe(claimed);
    expect(response.headers.get("x-request-id")).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  it("falls back to Vercel's id, keeping colons so the line joins their log view", async () => {
    const handler = withRoute("GET /api/halls", async () => ok());
    const response = await handler(
      new Request("http://localhost/api/halls", {
        headers: { "x-vercel-id": "iad1::abc123-1700000000000-def456" }
      })
    );

    expect(response.headers.get("x-request-id")).toBe(
      "iad1::abc123-1700000000000-def456"
    );
  });

  it("exposes the id to anything logging inside the handler", async () => {
    let seen: string | null = null;
    const handler = withRoute("GET /api/halls", async () => {
      seen = getRequestId();
      return ok();
    });
    const response = await handler(new Request("http://localhost/api/halls"));

    expect(seen).toBe(response.headers.get("x-request-id"));
  });
});

describe("withRoute completion line", () => {
  it("records the method, status, duration and route pattern", async () => {
    const handler = withRoute("POST /api/events", async () => ok());
    await handler(
      new Request("http://localhost/api/events", { method: "POST" })
    );

    const line = logLines.find((entry) =>
      entry.includes("request_completed")
    );

    expect(line).toBeDefined();
    const parsed = JSON.parse(line as string);
    expect(parsed.route).toBe("POST /api/events");
    expect(parsed.method).toBe("POST");
    expect(parsed.status).toBe(200);
    expect(typeof parsed.durationMs).toBe("number");
    expect(parsed.requestId).toBeDefined();
  });

  it("logs the route PATTERN, never the substituted path", async () => {
    const handler = withRoute("GET /api/events/[eventId]", async () => ok());
    await handler(
      new Request("http://localhost/api/events/11111111-2222-3333-4444-555555555555")
    );

    const line = logLines.find((entry) =>
      entry.includes("request_completed")
    ) as string;

    expect(line).toContain("GET /api/events/[eventId]");
    expect(line).not.toContain("11111111-2222-3333-4444-555555555555");
  });
});

describe("withRoute and the request body", () => {
  it("leaves the stream unread, so signature verification still sees it", async () => {
    // The Stripe webhook feeds `await request.text()` straight to signature
    // verification. A wrapper that peeked at the body - even for a size - would
    // turn every webhook into a 400.
    let body: string | null = null;
    const handler = withRoute("POST /api/billing/stripe/webhook", async (request) => {
      body = await request.text();
      return ok();
    });

    await handler(
      new Request("http://localhost/api/billing/stripe/webhook", {
        method: "POST",
        body: '{"id":"evt_1"}'
      })
    );

    expect(body).toBe('{"id":"evt_1"}');
  });

  it("keeps the body out of the log line", async () => {
    const handler = withRoute("POST /api/clients", async (request) => {
      await request.text();
      return ok();
    });

    await handler(
      new Request("http://localhost/api/clients", {
        method: "POST",
        body: '{"clientName":"Wedding of Someone Real"}'
      })
    );

    expect(logLines.join("")).not.toContain("Wedding of Someone Real");
  });
});

describe("withRoute as a safety net", () => {
  it("answers an escaped throw the way a route's own catch would", async () => {
    const handler = withRoute("GET /api/halls", async () => {
      throw new Error("no catch block here");
    });
    const response = await handler(new Request("http://localhost/api/halls"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "An unexpected server error occurred."
    });
  });

  it("still correlates the failure, because the scope outlives the throw", async () => {
    const handler = withRoute("GET /api/halls", async () => {
      throw new Error("boom");
    });
    const response = await handler(new Request("http://localhost/api/halls"));

    expect(response.headers.get("x-request-id")).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  it("does not leak the internal message to the caller but does log it", async () => {
    const handler = withRoute("GET /api/halls", async () => {
      throw new Error("connection string in here");
    });
    const response = await handler(new Request("http://localhost/api/halls"));
    const body = (await response.json()) as { error: string };

    expect(body.error).not.toContain("connection string");
    expect(logLines.join("")).toContain("unhandled_route_error");
  });
});

describe("withRoute and the context argument", () => {
  it("passes a dynamic route's params through untouched", async () => {
    let received: unknown = null;
    const handler = withRoute<{ params: Promise<{ eventId: string }> }>(
      "GET /api/events/[eventId]",
      async (_request, context) => {
        received = await context.params;
        return ok();
      }
    );

    await handler(new Request("http://localhost/api/events/abc"), {
      params: Promise.resolve({ eventId: "abc" })
    });

    expect(received).toEqual({ eventId: "abc" });
  });

  it("tolerates being called with one argument, as the unit tests do", async () => {
    const handler = withRoute("GET /api/halls", async (_request, context) => {
      expect(context).toBeUndefined();
      return ok();
    });

    await expect(
      handler(new Request("http://localhost/api/halls"))
    ).resolves.toBeInstanceOf(Response);
  });
});

describe("withRoute and the bound actor", () => {
  // `resolveActor` calls `bindActor` for real; these stand in for it so the
  // assertion is about the scope rather than about mocking the whole authz
  // stack. What matters is that the binding survives into the error path.
  const actor = {
    organizationId: "org-1",
    userId: "11111111-2222-3333-4444-555555555555",
    principalId: "principal-1"
  };

  it("tags every line emitted after the bind", async () => {
    const handler = withRoute("GET /api/events", async () => {
      bindActor(actor);
      log.info({ eventCount: 3 }, "events_listed");
      return ok();
    });

    await handler(new Request("http://localhost/api/events"));

    const line = logLines.find((entry) => entry.includes("events_listed"));
    const parsed = JSON.parse(line as string);

    expect(parsed.organizationId).toBe("org-1");
    expect(parsed.principalId).toBe("principal-1");
  });

  it("tags the completion line too, though the bind happened mid-request", async () => {
    const handler = withRoute("GET /api/events", async () => {
      bindActor(actor);
      return ok();
    });

    await handler(new Request("http://localhost/api/events"));

    const line = logLines.find((entry) => entry.includes("request_completed"));

    expect(JSON.parse(line as string).organizationId).toBe("org-1");
  });

  it("tags a denial, which is the line the binding exists for", async () => {
    // `authorize()` binds at resolution and throws afterwards, so the denial
    // has to name the tenant it was refused to. A denial logged without one
    // says that somebody was refused, not who.
    const handler = withRoute("GET /api/access/roles", async () => {
      bindActor(actor);
      throw new AuthorizationError(403, "Not permitted.", "not_permitted");
    });

    const response = await handler(
      new Request("http://localhost/api/access/roles")
    );

    expect(response.status).toBe(403);

    const line = logLines.find((entry) =>
      entry.includes("handled_route_error")
    );
    const parsed = JSON.parse(line as string);

    expect(parsed.organizationId).toBe("org-1");
    expect(parsed.kind).toBe("AuthorizationError");
  });

  it("never puts the actor's email on a line", async () => {
    const handler = withRoute("GET /api/events", async () => {
      // Not part of the bind signature at all - this is the belt to that
      // braces, asserting the redact list catches it if one is ever added.
      log.info({ userEmail: "someone@example.com" }, "events_listed");
      return ok();
    });

    await handler(new Request("http://localhost/api/events"));

    expect(logLines.join("")).not.toContain("someone@example.com");
  });

  it("does not leak one request's actor into the next", async () => {
    const bound = withRoute("GET /api/events", async () => {
      bindActor(actor);
      return ok();
    });
    const unbound = withRoute("GET /api/health", async () => ok());

    await bound(new Request("http://localhost/api/events"));
    logLines.length = 0;
    await unbound(new Request("http://localhost/api/health"));

    const line = logLines.find((entry) => entry.includes("request_completed"));

    expect(JSON.parse(line as string).organizationId).toBeUndefined();
  });
});
