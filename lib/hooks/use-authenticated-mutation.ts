"use client";

import { useCallback, useState } from "react";
import { invalidateAuthenticatedQuery } from "@/lib/hooks/use-authenticated-query";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

export function useAuthenticatedMutation<TInput, TOutput>(
  url: string,
  method: "POST" | "PATCH" | "DELETE" = "POST"
) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resetError = useCallback(() => setError(null), []);

  const mutate = useCallback(
    async (input: TInput) => {
      setIsPending(true);
      setError(null);

      try {
        const response = await authenticatedFetch(url, {
          method,
          body: JSON.stringify(input)
        });
        const payload = (await response.json().catch(() => null)) as
          | (TOutput & { error?: string })
          | null;

        if (!response.ok) {
          throw new Error(
            payload?.error ?? `Request failed with status ${response.status}.`
          );
        }

        invalidateAuthenticatedQuery(url);
        return payload as TOutput;
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : "Unable to save changes.";
        setError(message);
        throw mutationError;
      } finally {
        setIsPending(false);
      }
    },
    [method, url]
  );

  return { mutate, isPending, error, resetError };
}
