import { z } from "zod";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth/auth-error-messages";
import { getPasswordValidationError } from "@/lib/auth/password";

/**
 * Shared by the login and sign-up forms, so every entry point agrees on what a
 * usable email address is.
 */
export const emailField = z
  .string()
  .trim()
  .min(1, "Please enter your email address.")
  // 254 is the practical RFC 5321 ceiling for a whole address.
  .max(254, AUTH_ERROR_MESSAGES.invalidEmail)
  .email(AUTH_ERROR_MESSAGES.invalidEmail);

/**
 * Password rules live in lib/auth/password.ts and are already covered by
 * tests/unit/auth-password.test.ts. Delegating keeps one source of truth
 * instead of restating the 8-character and 72-byte limits here.
 */
const signUpPasswordField = z.string().superRefine((value, context) => {
  const message = getPasswordValidationError(value);

  if (message) {
    context.addIssue({ code: z.ZodIssueCode.custom, message });
  }
});

export const BOTH_CREDENTIALS_REQUIRED =
  "Please enter your email address and password.";

export const loginSchema = z.object({
  email: emailField,
  // Checked on the trimmed value but never trimmed: an all-whitespace entry is
  // a mistake, yet a real password may legitimately contain spaces.
  password: z
    .string()
    .refine((value) => value.trim().length > 0, "Please enter your password.")
});

export const signUpSchema = z.object({
  email: emailField,
  password: signUpPasswordField
});

/**
 * Returns the first problem with the sign-in form, or null when it is usable.
 *
 * When BOTH fields are blank the combined message is kept: it reads better
 * than two separate complaints, and it is the copy the e2e suite asserts.
 */
export function getLoginValidationError(input: {
  email: string;
  password: string;
}): string | null {
  if (!input.email.trim() && !input.password.trim()) {
    return BOTH_CREDENTIALS_REQUIRED;
  }

  const parsed = loginSchema.safeParse(input);

  if (parsed.success) return null;

  return parsed.error.issues[0]?.message ?? BOTH_CREDENTIALS_REQUIRED;
}

/** Returns the first problem with the sign-up form, or null when it is usable. */
export function getSignUpValidationError(input: {
  email: string;
  password: string;
}): string | null {
  const parsed = signUpSchema.safeParse(input);

  if (parsed.success) return null;

  // Email first: a malformed address is the more actionable complaint when
  // both fields are wrong.
  const emailIssue = parsed.error.issues.find(
    (issue) => issue.path[0] === "email"
  );

  return (
    emailIssue?.message ??
    parsed.error.issues[0]?.message ??
    AUTH_ERROR_MESSAGES.genericSignUpFailure
  );
}
