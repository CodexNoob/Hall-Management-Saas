import { describe, expect, it } from "vitest";
import {
  AUTH_ERROR_MESSAGES,
  getAuthErrorMessage
} from "@/lib/auth/auth-error-messages";

describe("login error copy", () => {
  it("maps Supabase auth codes to employee-facing copy", () => {
    expect(
      getAuthErrorMessage({ code: "invalid_credentials", status: 400 })
    ).toBe(AUTH_ERROR_MESSAGES.incorrectCredentials);
    expect(
      getAuthErrorMessage({ code: "email_not_confirmed", status: 400 })
    ).toBe(AUTH_ERROR_MESSAGES.emailNotConfirmed);
    expect(getAuthErrorMessage({ code: "user_banned", status: 400 })).toBe(
      AUTH_ERROR_MESSAGES.accountDisabled
    );
  });

  it("never leaks Supabase's raw developer-facing strings", () => {
    expect(getAuthErrorMessage({ message: "Invalid login credentials" })).toBe(
      AUTH_ERROR_MESSAGES.incorrectCredentials
    );
    expect(getAuthErrorMessage({ message: "Email not confirmed" })).toBe(
      AUTH_ERROR_MESSAGES.emailNotConfirmed
    );
    expect(getAuthErrorMessage(new Error("Request rate limit reached"))).toBe(
      AUTH_ERROR_MESSAGES.rateLimited
    );
  });

  it("prefers the message over the status code when both are present", () => {
    // An unconfirmed email and a wrong password both return HTTP 400, so the
    // status alone must not decide the copy.
    expect(
      getAuthErrorMessage({ status: 400, message: "Email not confirmed" })
    ).toBe(AUTH_ERROR_MESSAGES.emailNotConfirmed);
  });

  it("falls back to the status when there is no recognisable message", () => {
    expect(getAuthErrorMessage({ status: 429, message: "" })).toBe(
      AUTH_ERROR_MESSAGES.rateLimited
    );
    expect(getAuthErrorMessage({ status: 422 })).toBe(
      AUTH_ERROR_MESSAGES.incorrectCredentials
    );
  });

  it("passes through actionable server copy from /api/auth/sync-user", () => {
    const invitationRequired =
      "No employee account was found for this email. Ask your organization administrator for an invitation.";

    expect(getAuthErrorMessage(new Error(invitationRequired))).toBe(
      invitationRequired
    );
  });

  it("uses the fallback for unusable errors", () => {
    expect(getAuthErrorMessage(undefined)).toBe(
      AUTH_ERROR_MESSAGES.genericSignInFailure
    );
    expect(getAuthErrorMessage(null)).toBe(
      AUTH_ERROR_MESSAGES.genericSignInFailure
    );
    expect(getAuthErrorMessage(new Error(""))).toBe(
      AUTH_ERROR_MESSAGES.genericSignInFailure
    );
    expect(getAuthErrorMessage({}, "Unable to start social login.")).toBe(
      "Unable to start social login."
    );
  });
});
