"use client";

import { useCallback, useEffect, useState } from "react";
import { getCachedSyncedUser } from "@/lib/auth/client";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

type QueryState<T> = {
  data: T | null;
  error: string | null;
  isLoading: boolean;
};

type CachedQuery = {
  data: unknown;
  updatedAt: number;
};

// Dashboard data remains immediately reusable while navigating between modules.
// Mutations explicitly invalidate affected queries, so a longer stale window avoids
// repeating identical API/database work during ordinary navigation.
const QUERY_STALE_TIME_MS = 2 * 60 * 1000;
const queryCache = new Map<string, CachedQuery>();
const queriesInFlight = new Map<string, Promise<unknown>>();
let queryCacheGeneration = 0;

export function invalidateAuthenticatedQuery(url: string) {
  for (const key of queryCache.keys()) {
    if (key.endsWith(`:${url}`)) {
      queryCache.delete(key);
    }
  }
}

export function clearAuthenticatedQueryCache() {
  queryCacheGeneration += 1;
  queryCache.clear();
  queriesInFlight.clear();
}

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
  const cachedUser = getCachedSyncedUser();
  const userId = cachedUser?.user.id ?? "no-user";
  const organizationId =
    cachedUser?.activeOrganizationId ?? "no-organization";
  const queryKey = `${userId}:${organizationId}:${url}`;
  const [state, setState] = useState<QueryState<T>>(() => {
    const cached = queryCache.get(queryKey);
    return {
      data: enabled && cached ? (cached.data as T) : null,
      error: null,
      isLoading: enabled && !cached
    };
  });

  const refetch = useCallback(
    async (showLoading = false) => {
      const cached = queryCache.get(queryKey);
      setState((current) => ({
        ...current,
        error: null,
        isLoading: showLoading || (!cached && !current.data)
      }));

      try {
        let request = queriesInFlight.get(queryKey) as
          | Promise<T>
          | undefined;

        if (!request) {
          const requestGeneration = queryCacheGeneration;
          request = authenticatedFetch(url)
            .then(readJson<T>)
            .then((data) => {
              if (requestGeneration === queryCacheGeneration) {
                queryCache.set(queryKey, { data, updatedAt: Date.now() });
              }
              return data;
            })
            .finally(() => {
              queriesInFlight.delete(queryKey);
            });
          queriesInFlight.set(queryKey, request);
        }

        const data = await request;
        setState({ data, error: null, isLoading: false });
        return data;
      } catch (error) {
        setState({
          data: cached ? (cached.data as T) : null,
          error: cached
            ? null
            : error instanceof Error
              ? error.message
              : "Unable to load data.",
          isLoading: false
        });
        return null;
      }
    },
    [queryKey, url]
  );

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, error: null, isLoading: false });
      return;
    }

    const cached = queryCache.get(queryKey);
    const cacheIsFresh =
      cached && Date.now() - cached.updatedAt < QUERY_STALE_TIME_MS;

    if (cached) {
      setState({
        data: cached.data as T,
        error: null,
        isLoading: false
      });
    } else {
      setState({ data: null, error: null, isLoading: true });
    }

    if (!cacheIsFresh) {
      void refetch(!cached);
    }
  }, [enabled, queryKey, refetch]);

  return { ...state, refetch: () => refetch(false) };
}
