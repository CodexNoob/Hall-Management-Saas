export const MIN_PASSWORD_LENGTH = 8;
// GoTrue hashes with bcrypt, which silently truncates past 72 bytes.
export const MAX_PASSWORD_LENGTH = 72;
export const PASSWORD_RULES_HINT =
  "Use at least 8 characters, including a letter and a number.";

export function getPasswordValidationError(
  password: string,
  confirmPassword?: string
): string | null {
  if (!password) return "Please enter a new password.";

  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (new TextEncoder().encode(password).length > MAX_PASSWORD_LENGTH) {
    return `Passwords cannot be longer than ${MAX_PASSWORD_LENGTH} characters.`;
  }

  if (!/[A-Za-z]/.test(password)) return "Include at least one letter.";
  if (!/\d/.test(password)) return "Include at least one number.";

  if (confirmPassword !== undefined && password !== confirmPassword) {
    return "Passwords do not match.";
  }

  return null;
}
