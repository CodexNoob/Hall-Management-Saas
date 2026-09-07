import { afterEach, describe, expect, it, vi } from "vitest";
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import {
  bindActorToErrorScope,
  captureException,
  registerErrorReporter,
  resetErrorReporter
} from "@/lib/logging/report";
import { scrubBreadcrumbUrl, scrubEventRequest } from "@/lib/logging/scrub-event";

/**
 * The error plane, asserted at the points where it can fail quietly: reporting
 * that is off and does not say so, and reporting that is on and carries data it
 * should not.
 */

describe("captureException with no reporter registered", () => {
  // The state every unit test, script and cron runs in - and the state the
  // application itself runs in until `sentry.server.config.ts` executes.
  it("returns null rather than an id for an event that was never sent", () => {
    // An id here would be worse than nothing: `createApiErrorResponse` puts it
    // on the log line as `sentryId`, and a join key pointing at a row that does
    // not exist sends whoever follows it to an empty search.
    expect(captureException(new Error("boom"))).toBeNull();
  });

  it("never throws, whatever it is handed", () => {
    // It runs inside the error path, so an exception raised here would turn a
    // handled 500 into an unhandled one.
    expect(() => captureException(new Error("boom"))).not.toThrow();
    expect(() => captureException("a bare string")).not.toThrow();
    expect(() => captureException(undefined)).not.toThrow();
    expect(() => captureException({ circular: {} })).not.toThrow();
  });
});

describe("captureException with a reporter registered", () => {
  afterEach(() => resetErrorReporter());

  function fakeReporter(isEnabled: boolean) {
    const reporter = {
      isEnabled: () => isEnabled,
      captureException: vi.fn(() => "sentry-event-id"),
      setTag: vi.fn(),
      setUser: vi.fn()
    };

    registerErrorReporter(reporter);

    return reporter;
  }

  it("returns the id the reporter produced", () => {
    const reporter = fakeReporter(true);
    const error = new Error("boom");

    expect(captureException(error)).toBe("sentry-event-id");
    expect(reporter.captureException).toHaveBeenCalledWith(error);
  });

  it("stays silent when the reporter has no destination", () => {
    // An initialised SDK with no DSN. `captureException` would still hand back
    // an id, for an event nobody received.
    const reporter = fakeReporter(false);

    expect(captureException(new Error("boom"))).toBeNull();
    expect(reporter.captureException).not.toHaveBeenCalled();
  });

  it("swallows a reporter that throws instead of raising a second error", () => {
    registerErrorReporter({
      isEnabled: () => true,
      captureException: () => {
        throw new Error("the SDK itself failed");
      },
      setTag: vi.fn(),
      setUser: vi.fn()
    });

    expect(captureException(new Error("boom"))).toBeNull();
  });

  it("binds the tenant as a tag and the user as a bare uuid", () => {
    const reporter = fakeReporter(true);

    bindActorToErrorScope({
      organizationId: "org-1",
      userId: "user-1",
      principalId: "principal-1"
    });

    expect(reporter.setTag).toHaveBeenCalledWith("organizationId", "org-1");
    // The uuid and nothing else. `AuthzContext` carries an email as well, and
    // it must never reach the error plane.
    expect(reporter.setUser).toHaveBeenCalledWith({ id: "user-1" });
  });
});

describe("event scrubbing", () => {
  function eventWith(request: NonNullable<ErrorEvent["request"]>): ErrorEvent {
    return { request } as ErrorEvent;
  }

  it("drops the request body", () => {
    const event = scrubEventRequest(
      eventWith({ data: { clientName: "Rivera Wedding", total: 4200 } })
    );

    expect(event.request?.data).toBeUndefined();
  });

  it("drops the cookie header in either casing", () => {
    // The Supabase session lives here as `sb-<ref>-auth-token`. Capturing it
    // hands a replayable credential to the log vendor.
    const event = scrubEventRequest(
      eventWith({
        headers: {
          cookie: "sb-abc-auth-token=live-session",
          Authorization: "Bearer live-token",
          "user-agent": "Mozilla/5.0"
        }
      })
    );

    expect(JSON.stringify(event.request?.headers)).not.toContain("live-session");
    expect(JSON.stringify(event.request?.headers)).not.toContain("live-token");
    // Kept: the point is to remove credentials, not to blind the report.
    expect(event.request?.headers?.["user-agent"]).toBe("Mozilla/5.0");
  });

  it("redacts one-time credentials out of the url and drops the query string", () => {
    const event = scrubEventRequest(
      eventWith({
        url: "https://app.example.com/auth/confirm?token_hash=live-hash&type=invite",
        query_string: "token_hash=live-hash&type=invite"
      })
    );

    expect(event.request?.url).not.toContain("live-hash");
    // Still recognisable as the confirm route - a scrub that destroys the
    // diagnostic value of the field defeats the point.
    expect(event.request?.url).toContain("/auth/confirm");
    expect(event.request?.url).toContain("type=invite");
    expect(event.request?.query_string).toBeUndefined();
  });

  it("leaves an event with no request attached alone", () => {
    expect(() => scrubEventRequest({} as ErrorEvent)).not.toThrow();
  });

  it("redacts credentials out of breadcrumb urls", () => {
    // Navigation breadcrumbs record the auth redirect chain, so the same
    // credential arrives by a second route if only the event is scrubbed.
    const breadcrumb = scrubBreadcrumbUrl({
      category: "navigation",
      data: { url: "/auth/callback?code=live-code" }
    } as Breadcrumb);

    expect(breadcrumb.data?.url).not.toContain("live-code");
    expect(breadcrumb.data?.url).toContain("/auth/callback");
  });

  it("leaves a breadcrumb with no url alone", () => {
    expect(() =>
      scrubBreadcrumbUrl({ category: "ui.click" } as Breadcrumb)
    ).not.toThrow();
  });
});

/*
 * The CSP and tunnel assertions live in `security-headers.test.ts`, not here.
 *
 * Importing `next.config.ts` pulls `withSentryConfig`, which loads Sentry's
 * webpack bundler plugin, and that plugin throws under Vitest's module runner.
 * That file stubs the wrapper to get around it; this one needs the REAL SDK, or
 * the no-DSN assertions above would be asserting against a stub and would pass
 * no matter what the facade did. The two cannot share a module graph.
 */
