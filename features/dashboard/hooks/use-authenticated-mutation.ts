"use client";

import { useCallback, useState } from "react";
import {
  invalidateAuthenticatedQuery,
  setAuthenticatedQueryData
} from "@/features/dashboard/hooks/use-authenticated-query";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { ApiRequestError, readApiError } from "@/lib/http/api-request-error";
import type { ZodFieldErrors } from "@/lib/http/zod-error-message";
import { ambientTranslate } from "@/lib/i18n/ambient";

export function useAuthenticatedMutation<TInput, TOutput>(
  url: string,
  method: "POST" | "PATCH" | "DELETE" = "POST",
  options: { cacheResponse?: boolean } = {}
) {
  const cacheResponse = options.cacheResponse ?? false;
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Populated when the server rejected the body with a schema error, so a form
  // can put the message next to the field that caused it.
  const [fieldErrors, setFieldErrors] = useState<ZodFieldErrors>({});
  // The correlation id of the last failure, for the UI to show alongside the
  // message. It is what a support ticket quotes, and it is the only field here
  // that is worth anything after the user has closed the dialog.
  const [requestId, setRequestId] = useState("");
  const resetError = useCallback(() => {
    setError(null);
    setFieldErrors({});
    setRequestId("");
  }, []);

  const mutate = useCallback(
    async (input: TInput) => {
      setIsPending(true);
      setError(null);
      setFieldErrors({});
      setRequestId("");

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

        if (cacheResponse && payload) {
          setAuthenticatedQueryData(url, payload);
        } else {
          invalidateAuthenticatedQuery(url);
        }
        return payload as TOutput;
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : ambientTranslate("common.unableToSaveChanges");
        setError(message);
        if (mutationError instanceof ApiRequestError) {
          setFieldErrors(mutationError.fieldErrors);
          setRequestId(mutationError.requestId);
        }
        throw mutationError;
      } finally {
        setIsPending(false);
      }
    },
    [cacheResponse, method, url]
  );

  return { mutate, isPending, error, fieldErrors, requestId, resetError };
}
