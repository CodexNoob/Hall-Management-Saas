import { describe, expect, it } from "vitest";
import {
  BOTH_CREDENTIALS_REQUIRED,
  emailField,
  getLoginValidationError,
  getSignUpValidationError
} from "@/features/auth/validations/auth.schema";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth/auth-error-messages";
import { MAX_PASSWORD_LENGTH } from "@/lib/auth/password";

describe("emailField", () => {
  it("trims and accepts a normal address", () => {
    expect(emailField.parse("  owner@example.com  ")).toBe("owner@example.com");
  });

  it("accepts subaddressing, which the e2e accounts rely on", () => {
    expect(emailField.parse("owner+e2e@example.com")).toBe(
      "owner+e2e@example.com"
    );
  });

  it("rejects malformed addresses with the shared copy", () => {
    for (const value of ["owner@", "not-an-email", "@example.com", "a b@c.com"]) {
      const result = emailField.safeParse(value);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          AUTH_ERROR_MESSAGES.invalidEmail
        );
      }
    }
  });

  it("treats blank and whitespace-only input as missing", () => {
    expect(emailField.safeParse("").success).toBe(false);
    expect(emailField.safeParse("   ").success).toBe(false);
  });

  it("rejects an address past the practical length limit", () => {
    expect(
      emailField.safeParse(`${"a".repeat(250)}@example.com`).success
    ).toBe(false);
  });
});

describe("getLoginValidationError", () => {
  it("keeps the combined message when both fields are blank", () => {
    // The e2e suite asserts this exact string, and it reads better than two
    // separate complaints.
    expect(getLoginValidationError({ email: "", password: "" })).toBe(
      BOTH_CREDENTIALS_REQUIRED
    );
    expect(getLoginValidationError({ email: "  ", password: "  " })).toBe(
      BOTH_CREDENTIALS_REQUIRED
    );
  });

  it("names the missing field when only one is blank", () => {
    expect(
      getLoginValidationError({ email: "owner@example.com", password: "" })
    ).toBe("Please enter your password.");
    expect(getLoginValidationError({ email: "", password: "Secret123" })).toBe(
      "Please enter your email address."
    );
  });

  it("catches a malformed address before any network call", () => {
    expect(
      getLoginValidationError({ email: "not-an-email", password: "Secret123" })
    ).toBe(AUTH_ERROR_MESSAGES.invalidEmail);
  });

  it("treats an all-whitespace password as missing without trimming real ones", () => {
    expect(
      getLoginValidationError({ email: "owner@example.com", password: "    " })
    ).toBe("Please enter your password.");
    // A real password may legitimately contain spaces.
    expect(
      getLoginValidationError({ email: "owner@example.com", password: " a b " })
    ).toBeNull();
  });

  it("does not judge the password beyond requiring one", () => {
    // An existing account may predate the current rules; that is Supabase's
    // call to make, not the login form's.
    expect(
      getLoginValidationError({ email: "owner@example.com", password: "x" })
    ).toBeNull();
  });
});

describe("getSignUpValidationError", () => {
  it("accepts a usable pair", () => {
    expect(
      getSignUpValidationError({
        email: "owner@example.com",
        password: "Testing12345"
      })
    ).toBeNull();
  });

  it("reports the address before the password when both are wrong", () => {
    expect(
      getSignUpValidationError({ email: "nope", password: "short" })
    ).toBe(AUTH_ERROR_MESSAGES.invalidEmail);
  });

  it("delegates the password rules to lib/auth/password", () => {
    const valid = "owner@example.com";

    expect(getSignUpValidationError({ email: valid, password: "short1" })).toBe(
      "Use at least 8 characters."
    );
    expect(
      getSignUpValidationError({ email: valid, password: "passwordonly" })
    ).toBe("Include at least one number.");
    expect(
      getSignUpValidationError({ email: valid, password: "12345678" })
    ).toBe("Include at least one letter.");
  });

  it("blocks a password past the bcrypt byte limit before any account is made", () => {
    expect(
      getSignUpValidationError({
        email: "owner@example.com",
        password: `a1${"x".repeat(MAX_PASSWORD_LENGTH)}`
      })
    ).toBe(`Passwords cannot be longer than ${MAX_PASSWORD_LENGTH} characters.`);
  });
});
