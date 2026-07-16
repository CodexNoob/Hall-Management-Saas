"use client";

import { useCallback, useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

type QueryState<T> = {
  data: T | null;
  error: string | null;
  isLoading: boolean;
};

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(
      payload?.error ?? `Request failed with status ${response.status}.`
    );
  }

  return payload as T;
}

export function useAuthenticatedQuery<T>(url: string, enabled = true) {
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    error: null,
    isLoading: enabled
  });

  const refetch = useCallback(
    async (signal?: AbortSignal) => {
      setState((current) => ({ ...current, error: null, isLoading: true }));

      try {
        const response = await authenticatedFetch(url, { signal });
        const data = await readJson<T>(response);
        setState({ data, error: null, isLoading: false });
        return data;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return null;
        setState({
          data: null,
          error:
            error instanceof Error ? error.message : "Unable to load data.",
          isLoading: false
        });
        return null;
      }
    },
    [url]
  );

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, error: null, isLoading: false });
      return;
    }

    const controller = new AbortController();
    void refetch(controller.signal);
    return () => controller.abort();
  }, [enabled, refetch]);

  return { ...state, refetch: () => refetch() };
}
