import type { ZodFieldErrors } from "@/lib/http/zod-error-message";

/**
 * A failed same-origin API call, carrying the server's per-field detail.
 *
 * `createApiErrorResponse` returns `{ error, issues }` for a schema rejection.
 * Reading it in one shared place means both transports - the
 * `useAuthenticatedMutation` hook and the direct `authenticatedFetch` calls in
 * features/billing - surface the same message and the same field errors.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly fieldErrors: ZodFieldErrors;

  constructor(message: string, status: number, fieldErrors: ZodFieldErrors = {}) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

type ApiErrorPayload = {
  error?: unknown;
  issues?: { fieldErrors?: unknown } | null;
};

function readFieldErrors(payload: ApiErrorPayload | null): ZodFieldErrors {
  const raw = payload?.issues?.fieldErrors;

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const fieldErrors: ZodFieldErrors = {};

  for (const [field, messages] of Object.entries(raw)) {
    if (Array.isArray(messages)) {
      const strings = messages.filter(
        (message): message is string => typeof message === "string"
      );
      if (strings.length > 0) fieldErrors[field] = strings;
    }
  }

  return fieldErrors;
}

/** Builds an ApiRequestError from a non-ok Response. Never throws. */
export async function readApiError(response: Response): Promise<ApiRequestError> {
  const payload = (await response
    .json()
    .catch(() => null)) as ApiErrorPayload | null;
  const message =
    typeof payload?.error === "string" && payload.error.trim()
      ? payload.error
      : `Request failed with status ${response.status}.`;

  return new ApiRequestError(message, response.status, readFieldErrors(payload));
}
