import { describe, expect, it } from "vitest";
import {
  describeAuthCallbackError,
  isExpiredLinkError,
  isPasswordSetupFlow,
  parseAuthCallbackParams
} from "@/lib/auth/auth-callback-params";

const origin = "https://app.example.com/auth/callback";

describe("parseAuthCallbackParams", () => {
  it("reads the link type from the hash fragment, where the implicit flow puts it", () => {
    const params = parseAuthCallbackParams(
      `${origin}#access_token=abc&refresh_token=def&type=recovery`
    );
    expect(params.type).toBe("recovery");
    expect(params.errorDescription).toBeNull();
  });

  it("reads an invite link", () => {
    expect(
      parseAuthCallbackParams(`${origin}#access_token=abc&type=invite`).type
    ).toBe("invite");
  });

  it("lets the query string win over the hash", () => {
    expect(
      parseAuthCallbackParams(`${origin}?type=invite#type=recovery`).type
    ).toBe("invite");
  });

  it("ignores link types it does not recognize", () => {
    expect(parseAuthCallbackParams(`${origin}#type=teleport`).type).toBeNull();
    expect(parseAuthCallbackParams(origin).type).toBeNull();
  });

  it("surfaces an expired-link error from the fragment", () => {
    const params = parseAuthCallbackParams(
      `${origin}#error=access_denied&error_description=Email+link+is+invalid+or+has+expired`
    );
    expect(params.errorDescription).toBe("Email link is invalid or has expired");
    expect(params.type).toBeNull();
  });

  it("falls back to the bare error code when no description is given", () => {
    expect(
      parseAuthCallbackParams(`${origin}#error=access_denied`).errorDescription
    ).toBe("access_denied");
  });

  it("reads next from the query string only", () => {
    expect(
      parseAuthCallbackParams(`${origin}?next=%2Fdashboard%2Fstaff`).next
    ).toBe("/dashboard/staff");
    expect(parseAuthCallbackParams(`${origin}#next=%2Fdashboard`).next).toBeNull();
  });

  it("returns empty params for an unparseable href instead of throwing", () => {
    expect(parseAuthCallbackParams("not-a-url")).toEqual({
      type: null,
      errorCode: null,
      errorDescription: null,
      next: null
    });
  });

  it("reads the error code that distinguishes an expired link", () => {
    expect(
      parseAuthCallbackParams(
        `${origin}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`
      ).errorCode
    ).toBe("otp_expired");
    expect(parseAuthCallbackParams(origin).errorCode).toBeNull();
  });
});

describe("isExpiredLinkError", () => {
  it("recognizes an expired or already-spent token", () => {
    expect(
      isExpiredLinkError(
        parseAuthCallbackParams(
          `${origin}#error=access_denied&error_code=otp_expired`
        )
      )
    ).toBe(true);
  });

  it("leaves other failures to the generic path", () => {
    expect(
      isExpiredLinkError(
        parseAuthCallbackParams(
          `${origin}#error=server_error&error_code=unexpected_failure`
        )
      )
    ).toBe(false);
    expect(isExpiredLinkError(parseAuthCallbackParams(origin))).toBe(false);
  });
});

describe("describeAuthCallbackError", () => {
  it("explains an expired link in terms the recipient can act on", () => {
    const message = describeAuthCallbackError(
      parseAuthCallbackParams(
        `${origin}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`
      )
    );
    expect(message).toContain("expired");
    expect(message).toContain("new invitation");
  });

  it("passes through the description Supabase gave for anything else", () => {
    expect(
      describeAuthCallbackError(
        parseAuthCallbackParams(
          `${origin}#error=server_error&error_description=Database+error+saving+new+user`
        )
      )
    ).toBe("Database error saving new user");
  });

  it("still says something useful when no description is present", () => {
    expect(describeAuthCallbackError(parseAuthCallbackParams(origin))).toContain(
      "could not be verified"
    );
  });
});

describe("isPasswordSetupFlow", () => {
  it("covers invite and recovery links", () => {
    expect(isPasswordSetupFlow("invite")).toBe(true);
    expect(isPasswordSetupFlow("recovery")).toBe(true);
  });

  it("leaves ordinary sign-ins alone", () => {
    expect(isPasswordSetupFlow("signup")).toBe(false);
    expect(isPasswordSetupFlow("magiclink")).toBe(false);
    expect(isPasswordSetupFlow("email_change")).toBe(false);
    expect(isPasswordSetupFlow(null)).toBe(false);
  });
});
