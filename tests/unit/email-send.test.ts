import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ trackedFetch: vi.fn() }));

vi.mock("@/lib/logging/outbound", () => ({ trackedFetch: mocks.trackedFetch }));

import { escapeHtml, sendTransactionalEmail } from "@/lib/email/send";

/**
 * THE ONE PLACE EMAIL LEAVES THIS APPLICATION.
 *
 * It exists because there were three copies of "post some HTML to a provider",
 * against two different providers, and only one of the two was ever configured
 * - so support tickets and booking notifications silently sent nothing while
 * beta emails went out fine. Nothing failed; the senders checked for a key they
 * did not have and returned.
 */

const email = {
  to: "cook@example.com",
  subject: "Roast Chicken assigned",
  html: "<p>Assigned</p>"
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("BREVO_API_KEY", "test-key");
  vi.stubEnv("SUPPORT_EMAIL_FROM", "Event Core <noreply@example.com>");
  mocks.trackedFetch.mockResolvedValue({ ok: true, status: 200 });
});

const body = () =>
  JSON.parse((mocks.trackedFetch.mock.calls[0]?.[2] as { body: string }).body);

describe("sending", () => {
  it("posts to Brevo through trackedFetch", async () => {
    await expect(sendTransactionalEmail(email)).resolves.toBe(true);

    expect(mocks.trackedFetch.mock.calls[0]?.[0]).toEqual({
      vendor: "brevo",
      operation: "smtp.email"
    });
    expect(mocks.trackedFetch.mock.calls[0]?.[1]).toBe(
      "https://api.brevo.com/v3/smtp/email"
    );
  });

  /**
   * `SUPPORT_EMAIL_FROM` holds the usual `Name <address>` form and Brevo wants
   * the two apart. Getting this wrong sends every email from a literal address
   * of "Event Core <noreply@example.com>", which no provider accepts.
   */
  it("splits a named sender into a name and an address", async () => {
    await sendTransactionalEmail(email);

    expect(body().sender).toEqual({
      name: "Event Core",
      email: "noreply@example.com"
    });
  });

  it("takes a bare address as an address", async () => {
    vi.stubEnv("SUPPORT_EMAIL_FROM", "noreply@example.com");
    await sendTransactionalEmail(email);

    expect(body().sender).toEqual({ email: "noreply@example.com" });
  });

  it("sends to exactly one recipient", async () => {
    await sendTransactionalEmail(email);

    expect(body().to).toEqual([{ email: "cook@example.com" }]);
  });

  it("carries a reply-to only when one was given", async () => {
    await sendTransactionalEmail(email);
    expect(body().replyTo).toBeUndefined();

    mocks.trackedFetch.mockClear();
    await sendTransactionalEmail({ ...email, replyTo: "client@example.com" });
    expect(body().replyTo).toEqual({ email: "client@example.com" });
  });
});

/**
 * TWO KINDS OF FAILURE, TREATED DIFFERENTLY ON PURPOSE.
 *
 * "No provider configured" is a deployment state a venue may legitimately be
 * in, and it must not turn every booking into an error. "The provider refused
 * this" is something a caller may want to retry or record, so it is raised.
 */
describe("failure", () => {
  it("returns false rather than throwing when no key is configured", async () => {
    vi.stubEnv("BREVO_API_KEY", "");

    await expect(sendTransactionalEmail(email)).resolves.toBe(false);
    expect(mocks.trackedFetch).not.toHaveBeenCalled();
  });

  it("returns false rather than throwing when no sender is configured", async () => {
    vi.stubEnv("SUPPORT_EMAIL_FROM", "");

    await expect(sendTransactionalEmail(email)).resolves.toBe(false);
    expect(mocks.trackedFetch).not.toHaveBeenCalled();
  });

  it("throws when the provider refuses", async () => {
    mocks.trackedFetch.mockResolvedValue({ ok: false, status: 422 });

    await expect(sendTransactionalEmail(email)).rejects.toThrow("422");
  });

  /**
   * The status, never the recipient. A provider error frequently echoes the
   * request back, and that request contains an address - which would then be in
   * a stack trace, in a log, and in an error reporter.
   */
  it("puts no address in the error it throws", async () => {
    mocks.trackedFetch.mockResolvedValue({ ok: false, status: 422 });

    await expect(sendTransactionalEmail(email)).rejects.toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining("cook@example.com")
      })
    );
  });
});

describe("escapeHtml", () => {
  it("keeps an ampersand in a client name readable", () => {
    expect(escapeHtml("Brown & Sons")).toBe("Brown &amp; Sons");
  });

  it("stops a typed name becoming markup", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
  });

  it("escapes quotes, which appear in attribute contexts", () => {
    expect(escapeHtml(`"O'Brien"`)).toBe("&quot;O&#39;Brien&quot;");
  });
});
