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
  /**
   * The rejection itemised, when the server can name what caused it - the
   * events and packages still holding a menu item, for example. Separate from
   * `fieldErrors` because these belong to no input field: nothing the user
   * typed is wrong, so there is no control to hang them off.
   */
  readonly details: string[];

  constructor(
    message: string,
    status: number,
    fieldErrors: ZodFieldErrors = {},
    details: string[] = []
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.details = details;
  }
}

type ApiErrorPayload = {
  error?: unknown;
  issues?: { fieldErrors?: unknown } | null;
  details?: unknown;
};

function readDetails(payload: ApiErrorPayload | null): string[] {
  if (!Array.isArray(payload?.details)) return [];

  return payload.details.filter(
    (detail): detail is string =>
      typeof detail === "string" && Boolean(detail.trim())
  );
}

/**
 * The itemised reasons behind a rejection, or `[]` for anything else.
 *
 * Takes `unknown` so a `catch` block can hand it whatever it caught: UI that
 * renders these only ever has the thrown value, not a narrowed one.
 */
export function readApiErrorDetails(error: unknown): string[] {
  return error instanceof ApiRequestError ? error.details : [];
}

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
export async function readApiError(
  response: Response
): Promise<ApiRequestError> {
  const payload = (await response
    .json()
    .catch(() => null)) as ApiErrorPayload | null;
  const message =
    typeof payload?.error === "string" && payload.error.trim()
      ? payload.error
      : `Request failed with status ${response.status}.`;

  return new ApiRequestError(
    message,
    response.status,
    readFieldErrors(payload),
    readDetails(payload)
  );
}
