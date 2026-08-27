import { describe, expect, it } from "vitest";
import {
  AUTH_ERROR_MESSAGES,
  getAuthErrorMessage,
  getSignUpErrorMessage
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

  it("passes through actionable server copy from /api/auth/session", () => {
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

describe("sign-up error copy", () => {
  it("maps Supabase sign-up codes to owner-facing copy", () => {
    expect(
      getSignUpErrorMessage({ code: "user_already_exists", status: 400 })
    ).toBe(AUTH_ERROR_MESSAGES.emailAlreadyRegistered);
    expect(getSignUpErrorMessage({ code: "weak_password", status: 422 })).toBe(
      AUTH_ERROR_MESSAGES.weakPassword
    );
    expect(
      getSignUpErrorMessage({ code: "email_address_invalid", status: 400 })
    ).toBe(AUTH_ERROR_MESSAGES.invalidEmail);
    expect(getSignUpErrorMessage({ code: "signup_disabled" })).toBe(
      AUTH_ERROR_MESSAGES.signUpDisabled
    );
  });

  it("never reports an existing account as a credential problem", () => {
    // The sign-in mapper turns HTTP 400 into "Incorrect email or password",
    // which is actively misleading here: the address is the problem, not a
    // password the user never typed before.
    const alreadyRegistered = {
      status: 400,
      message: "User already registered"
    };

    expect(getSignUpErrorMessage(alreadyRegistered)).toBe(
      AUTH_ERROR_MESSAGES.emailAlreadyRegistered
    );
    expect(getAuthErrorMessage(alreadyRegistered)).toBe(
      AUTH_ERROR_MESSAGES.incorrectCredentials
    );
  });

  it("separates email-send throttling from general rate limiting", () => {
    expect(
      getSignUpErrorMessage({ code: "over_email_send_rate_limit" })
    ).toBe(AUTH_ERROR_MESSAGES.emailSendRateLimited);
    expect(getSignUpErrorMessage({ code: "over_request_rate_limit" })).toBe(
      AUTH_ERROR_MESSAGES.rateLimited
    );
  });

  it("only promises a one-minute wait for the per-address cooldown", () => {
    // GoTrue reports the per-address cooldown and the project-wide hourly quota
    // under one code, so the message is the only thing that tells them apart.
    // Waiting a minute clears the first and does nothing for the second.
    expect(
      getSignUpErrorMessage({
        code: "over_email_send_rate_limit",
        status: 429,
        message: "For security purposes, you can only request this after 51 seconds."
      })
    ).toBe(AUTH_ERROR_MESSAGES.emailSendCooldown);

    expect(
      getSignUpErrorMessage({
        code: "over_email_send_rate_limit",
        status: 429,
        message: "Email rate limit exceeded"
      })
    ).toBe(AUTH_ERROR_MESSAGES.emailSendRateLimited);
  });

  it("does not blame the address when the sender refuses to deliver to it", () => {
    // Supabase's built-in mail service only delivers to members of the Supabase
    // organization. The message contains "email address", which the generic
    // substring test below it would otherwise flatten into "enter a valid email
    // address" - sending the owner hunting for a typo instead of surfacing a
    // project-configuration problem they cannot fix from the form.
    const refused = {
      code: "email_address_not_authorized",
      status: 403,
      message:
        "Email address not authorized. Emails can only be sent to members in your Supabase organization."
    };

    expect(getSignUpErrorMessage(refused)).toBe(
      AUTH_ERROR_MESSAGES.emailNotAuthorized
    );
    expect(getSignUpErrorMessage(refused)).not.toBe(
      AUTH_ERROR_MESSAGES.invalidEmail
    );
  });

  it("maps password complaints to the shared password rules", () => {
    expect(
      getSignUpErrorMessage(
        new Error("Password should be at least 6 characters.")
      )
    ).toBe(AUTH_ERROR_MESSAGES.weakPassword);
  });

  it("passes through actionable server copy and falls back otherwise", () => {
    const accessDenied = "Free trial access is not available for this email.";

    expect(getSignUpErrorMessage(new Error(accessDenied))).toBe(accessDenied);
    expect(getSignUpErrorMessage(undefined)).toBe(
      AUTH_ERROR_MESSAGES.genericSignUpFailure
    );
    expect(getSignUpErrorMessage(new Error(""))).toBe(
      AUTH_ERROR_MESSAGES.genericSignUpFailure
    );
  });
});
