// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The beta queue itself: what it records, what it refuses to record twice, and
 * what it does when the notification fails.
 *
 * The gate that READS these statuses is covered against the real sign-in route
 * in auth-session-route.test.ts, and the public endpoint in
 * beta-access-route.test.ts. This file is only the module underneath both.
 */

vi.mock("server-only", () => ({}));

const { findMany, upsert, update } = vi.hoisted(() => ({
  findMany: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { betaAccessRequest: { findMany, upsert, update } }
}));

// Hoisted for the same reason the doubles above are: vitest lifts the factory
// to the top of the file, so a plain `const` would not exist yet.
const { errorLog, warnLog } = vi.hoisted(() => ({
  errorLog: vi.fn(),
  warnLog: vi.fn()
}));

vi.mock("@/lib/logging/context", () => ({
  log: { error: errorLog, warn: warnLog, info: vi.fn() }
}));

import {
  isAutoApprovedBetaEmail,
  normalizeBetaEmail,
  recordAndNotifyBetaAccessRequest,
  recordBetaAccessRequest
} from "@/features/beta-access/server/beta-access";

const REQUESTED_AT = new Date("2026-09-03T09:00:00.000Z");
const AUTH_ID = "11111111-1111-4111-8111-111111111111";

function row(overrides: Record<string, unknown> = {}) {
  return {
    email: "applicant@example.com",
    status: "PENDING",
    signupMethod: "email_password",
    requestedAt: REQUESTED_AT,
    supabaseAuthId: null,
    ...overrides
  };
}

/** Every send Resend was asked to make, as parsed request bodies. */
function sentEmails() {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => String(url).includes("api.resend.com"))
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RESEND_API_KEY", "resend-key");
  vi.stubEnv("SUPPORT_EMAIL_FROM", "Event Core <no-reply@example.com>");
  vi.stubEnv("BETA_APPROVAL_EMAIL", "contactevent.pro1@gmail.com");
  vi.stubEnv("BETA_ACCESS_AUTO_APPROVE_EMAILS", "");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
  );

  findMany.mockResolvedValue([]);
  upsert.mockResolvedValue(row());
  update.mockResolvedValue(row());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("normalizeBetaEmail", () => {
  it("lower-cases and trims, and does nothing else", () => {
    expect(normalizeBetaEmail("  Applicant@Example.COM ")).toBe(
      "applicant@example.com"
    );
    // Dots and +tags are deliberately NOT stripped: `users.email` is matched
    // verbatim by provisioning, and two notions of "the same person" between
    // the gate and provisioning is a gap somebody walks through.
    expect(normalizeBetaEmail("a.b+beta@example.com")).toBe(
      "a.b+beta@example.com"
    );
  });
});

describe("recording a request", () => {
  it("opens a pending request for a new email/password registration", async () => {
    const result = await recordBetaAccessRequest({
      email: "Applicant@Example.com",
      signupMethod: "email_password"
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "applicant@example.com" },
        create: expect.objectContaining({
          email: "applicant@example.com",
          status: "PENDING",
          signupMethod: "email_password"
        })
      })
    );
    expect(result.status).toBe("PENDING");
    expect(result.isNew).toBe(true);
  });

  it("records a Google registration as one, with its identity", async () => {
    upsert.mockResolvedValue(row({ signupMethod: "google" }));

    const result = await recordBetaAccessRequest({
      email: "applicant@example.com",
      signupMethod: "google",
      supabaseAuthId: AUTH_ID
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          signupMethod: "google",
          supabaseAuthId: AUTH_ID
        })
      })
    );
    expect(result.signupMethod).toBe("google");
  });

  describe("duplicates", () => {
    it("returns the existing request rather than opening a second one", async () => {
      findMany.mockResolvedValue([row()]);

      const result = await recordBetaAccessRequest({
        email: "APPLICANT@example.com",
        signupMethod: "email_password"
      });

      expect(upsert).not.toHaveBeenCalled();
      expect(result.status).toBe("PENDING");
      expect(result.isNew).toBe(false);
    });

    it("matches on the authenticated identity even at another address", async () => {
      // The second key earning its keep: the same Google identity whose
      // Supabase email differs from the one they typed into our form.
      findMany.mockResolvedValue([
        row({ email: "typed@example.com", supabaseAuthId: AUTH_ID })
      ]);

      const result = await recordBetaAccessRequest({
        email: "google-account@example.com",
        supabaseAuthId: AUTH_ID
      });

      expect(upsert).not.toHaveBeenCalled();
      expect(result.email).toBe("typed@example.com");
      expect(result.isNew).toBe(false);
    });

    it("claims an unclaimed request for the identity that turns up", async () => {
      // The public form writes the row before Supabase has issued a session, so
      // without this the id stays NULL forever and only the address ever
      // matches.
      findMany.mockResolvedValue([row({ supabaseAuthId: null })]);

      await recordBetaAccessRequest({
        email: "applicant@example.com",
        supabaseAuthId: AUTH_ID
      });

      expect(update).toHaveBeenCalledWith({
        where: { email: "applicant@example.com" },
        data: { supabaseAuthId: AUTH_ID }
      });
    });

    it("never revives a rejected request by re-registering", async () => {
      findMany.mockResolvedValue([row({ status: "REJECTED" })]);

      const result = await recordBetaAccessRequest({
        email: "applicant@example.com"
      });

      expect(result.status).toBe("REJECTED");
      expect(upsert).not.toHaveBeenCalled();
    });
  });

  it("admits an allowlisted address without a human decision", async () => {
    vi.stubEnv(
      "BETA_ACCESS_AUTO_APPROVE_EMAILS",
      "Owner@Example.com, second@example.com"
    );
    upsert.mockResolvedValue(row({ status: "APPROVED" }));

    expect(isAutoApprovedBetaEmail("owner@example.com")).toBe(true);
    expect(isAutoApprovedBetaEmail("stranger@example.com")).toBe(false);

    const result = await recordBetaAccessRequest({ email: "owner@example.com" });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: "APPROVED" })
      })
    );
    expect(result.status).toBe("APPROVED");
  });

  it("treats an unset allowlist as empty rather than matching everything", () => {
    vi.stubEnv("BETA_ACCESS_AUTO_APPROVE_EMAILS", "");

    // `"".split(",")` yields `[""]`, so a bug here would auto-approve anything
    // normalizing to the empty string - and more importantly this pins that the
    // default posture is that everybody waits.
    expect(isAutoApprovedBetaEmail("anyone@example.com")).toBe(false);
  });
});

describe("notifying the team", () => {
  it("emails the applicant, method, time and status to BETA_APPROVAL_EMAIL", async () => {
    await recordAndNotifyBetaAccessRequest({
      email: "applicant@example.com",
      signupMethod: "email_password"
    });

    const [email] = sentEmails();

    // The address comes from the environment. Nothing in the code hardcodes it.
    expect(email.to).toEqual(["contactevent.pro1@gmail.com"]);
    expect(email.subject).toContain("New Event Core beta-access request");
    // The four things the notification has to carry.
    expect(email.html).toContain("applicant@example.com");
    expect(email.html).toContain("Email and password");
    expect(email.html).toContain(REQUESTED_AT.toISOString());
    expect(email.html).toContain("PENDING");
  });

  it("names Google as the method when that is how they registered", async () => {
    upsert.mockResolvedValue(row({ signupMethod: "google" }));

    await recordAndNotifyBetaAccessRequest({
      email: "applicant@example.com",
      signupMethod: "google"
    });

    expect(sentEmails()[0].html).toContain("Google");
  });

  it("stamps notifiedAt only once the mail has actually gone", async () => {
    await recordAndNotifyBetaAccessRequest({ email: "applicant@example.com" });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "applicant@example.com" },
        data: { notifiedAt: expect.any(Date) }
      })
    );
  });

  /**
   * The row is written before the send and the send cannot roll it back, so a
   * Resend outage costs a notification and never an applicant - and nothing
   * anywhere claims the request was seen when it was not.
   */
  it("keeps the request when the email fails, and logs the failure", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("no", { status: 500 }));

    const result = await recordAndNotifyBetaAccessRequest({
      email: "applicant@example.com"
    });

    expect(result.status).toBe("PENDING");
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledWith(
      expect.objectContaining({ email: "applicant@example.com" }),
      "beta_access_notification_failed"
    );
    // Nothing records that the team was told.
    expect(update).not.toHaveBeenCalled();
  });

  it("survives a deployment with no approval address configured", async () => {
    vi.stubEnv("BETA_APPROVAL_EMAIL", "");

    const result = await recordAndNotifyBetaAccessRequest({
      email: "applicant@example.com"
    });

    expect(result.status).toBe("PENDING");
    expect(sentEmails()).toHaveLength(0);
    expect(update).not.toHaveBeenCalled();
    expect(warnLog).toHaveBeenCalledWith(
      expect.anything(),
      "beta_access_notification_skipped_no_recipient"
    );
  });

  /**
   * The sign-up form is a public, unauthenticated way to cause an email. A
   * duplicate registration must not be a way to send another one.
   */
  it("does not re-email the team for a request already on file", async () => {
    findMany.mockResolvedValue([row()]);

    await recordAndNotifyBetaAccessRequest({ email: "applicant@example.com" });

    expect(sentEmails()).toHaveLength(0);
  });

  it("sends nothing for an address the allowlist admitted outright", async () => {
    // There is no decision for the team to make, so nothing to tell them about.
    vi.stubEnv("BETA_ACCESS_AUTO_APPROVE_EMAILS", "owner@example.com");
    upsert.mockResolvedValue(
      row({ email: "owner@example.com", status: "APPROVED" })
    );

    await recordAndNotifyBetaAccessRequest({ email: "owner@example.com" });

    expect(sentEmails()).toHaveLength(0);
  });
});
