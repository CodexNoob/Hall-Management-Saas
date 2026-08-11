import { describe, expect, it } from "vitest";
import {
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
      errorDescription: null,
      next: null
    });
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
