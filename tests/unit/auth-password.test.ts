import { describe, expect, it } from "vitest";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  getPasswordValidationError
} from "@/lib/auth/password";

describe("getPasswordValidationError", () => {
  it("accepts a password that satisfies every rule", () => {
    expect(getPasswordValidationError("Testing12345")).toBeNull();
    expect(getPasswordValidationError("Testing12345", "Testing12345")).toBeNull();
  });

  it("requires a value", () => {
    expect(getPasswordValidationError("")).toBe("Please enter a new password.");
  });

  it("rejects passwords shorter than the minimum", () => {
    expect(getPasswordValidationError("Test123")).toBe(
      `Use at least ${MIN_PASSWORD_LENGTH} characters.`
    );
  });

  it("requires at least one letter", () => {
    expect(getPasswordValidationError("123456789")).toBe(
      "Include at least one letter."
    );
  });

  it("requires at least one number", () => {
    expect(getPasswordValidationError("passwordpassword")).toBe(
      "Include at least one number."
    );
  });

  it("rejects all-whitespace passwords via the letter rule", () => {
    expect(getPasswordValidationError("          ")).toBe(
      "Include at least one letter."
    );
  });

  it("measures the maximum length in bytes, not characters", () => {
    // Each of these is 3 bytes in UTF-8, so 24 characters exceed the 72-byte
    // bcrypt limit even though the character count is well under it.
    const multiByte = `${"あ".repeat(24)}a1`;
    expect(multiByte.length).toBeLessThan(MAX_PASSWORD_LENGTH);
    expect(getPasswordValidationError(multiByte)).toBe(
      `Passwords cannot be longer than ${MAX_PASSWORD_LENGTH} characters.`
    );
  });

  it("allows a password that sits exactly on the byte limit", () => {
    const exact = `a1${"b".repeat(MAX_PASSWORD_LENGTH - 2)}`;
    expect(new TextEncoder().encode(exact).length).toBe(MAX_PASSWORD_LENGTH);
    expect(getPasswordValidationError(exact)).toBeNull();
  });

  it("reports a mismatch only when a confirmation is supplied", () => {
    expect(getPasswordValidationError("Testing12345", "Testing54321")).toBe(
      "Passwords do not match."
    );
    expect(getPasswordValidationError("Testing12345", undefined)).toBeNull();
  });

  it("checks the rules before the mismatch", () => {
    expect(getPasswordValidationError("short", "different")).toBe(
      `Use at least ${MIN_PASSWORD_LENGTH} characters.`
    );
  });
});
