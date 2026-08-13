"use client";

import { useCallback, useState } from "react";
import { invalidateAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { ApiRequestError, readApiError } from "@/lib/http/api-request-error";
import type { ZodFieldErrors } from "@/lib/http/zod-error-message";

export function useAuthenticatedMutation<TInput, TOutput>(
  url: string,
  method: "POST" | "PATCH" | "DELETE" = "POST"
) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Populated when the server rejected the body with a schema error, so a form
  // can put the message next to the field that caused it.
  const [fieldErrors, setFieldErrors] = useState<ZodFieldErrors>({});
  const resetError = useCallback(() => {
    setError(null);
    setFieldErrors({});
  }, []);

  const mutate = useCallback(
    async (input: TInput) => {
      setIsPending(true);
      setError(null);
      setFieldErrors({});

      try {
        const response = await authenticatedFetch(url, {
          method,
          body: JSON.stringify(input)
        });

        if (!response.ok) {
          throw await readApiError(response);
        }

        const payload = (await response.json().catch(() => null)) as
          | TOutput
          | null;

        invalidateAuthenticatedQuery(url);
        return payload as TOutput;
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : "Unable to save changes.";
        setError(message);
        if (mutationError instanceof ApiRequestError) {
          setFieldErrors(mutationError.fieldErrors);
        }
        throw mutationError;
      } finally {
        setIsPending(false);
      }
    },
    [method, url]
  );

  return { mutate, isPending, error, fieldErrors, resetError };
}
