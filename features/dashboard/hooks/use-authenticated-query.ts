"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getCachedAuthSession } from "@/lib/auth/client";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

/**
 * One client-side cache for every authenticated GET the dashboard makes.
 *
 * The store lives outside React so that a write from anywhere - a mutation
 * answering with the row it just saved, a prefetch on hover, an invalidation
 * from another panel - reaches every mounted reader of that url at once.
 * Components subscribe per key, so a write to one url re-renders only the
 * panels reading that url.
 *
 * The contract callers see:
 *
 * - `isLoading` is "there is nothing to draw yet", which is the signal a
 *   skeleton or spinner keys off. It is false the moment there is cached data,
 *   including data that is being refreshed.
 * - `isFetching` is "a request is in the air". It stays true through a
 *   background revalidation, when there is already data on screen.
 *
 * Keeping those two apart is what stops a cached panel from flashing a loading
 * state every time it is revisited.
 */

type QueryRecord<T> = {
  data: T | null;
  error: string | null;
  /** 0 until a response has landed, which is what "never loaded" means here. */
  updatedAt: number;
  isFetching: boolean;
  /**
   * Bumped every time `data` is replaced, by a read or by a mutation writing
   * its answer in. A read that started before the number moved is answering
   * about a version of the row that has since been superseded; see runQuery.
   */
  dataVersion: number;
};

// Dashboard data remains immediately reusable while navigating between modules.
// Mutations write their response straight into the cache, so a longer stale
// window avoids repeating identical API/database work during ordinary
// navigation without leaving anyone looking at something out of date.
const DEFAULT_STALE_TIME_MS = 2 * 60 * 1000;

// An upper bound on entries so that sweeping a long list - a hundred events,
// each with its own menu url - cannot grow the map without end. Anything a
// mounted component is currently reading is never evicted; see evictOverflow.
const MAX_CACHED_QUERIES = 64;

const EMPTY_RECORD: QueryRecord<unknown> = {
  data: null,
  error: null,
  updatedAt: 0,
  isFetching: false,
  dataVersion: 0
};

const entries = new Map<string, QueryRecord<unknown>>();
const subscribers = new Map<string, Set<() => void>>();
const requestsInFlight = new Map<string, Promise<unknown>>();

// Bumped on sign-out. A response from before the bump belongs to the previous
// session and is dropped rather than written into the fresh cache.
let cacheGeneration = 0;

function queryKeyFor(url: string) {
  const cachedUser = getCachedAuthSession();
  const userId = cachedUser?.user.id ?? "no-user";
  const organizationId = cachedUser?.activeOrganizationId ?? "no-organization";

  return `${userId}:${organizationId}:${url}`;
}

function readRecord(key: string) {
  return entries.get(key) ?? EMPTY_RECORD;
}

/**
 * There is nothing to read on the server, and the reference has to be stable:
 * useSyncExternalStore compares snapshots by identity and would loop forever on
 * a fresh object each call.
 */
function readServerRecord() {
  return EMPTY_RECORD;
}

function notify(key: string) {
  const listeners = subscribers.get(key);

  if (!listeners) return;

  for (const listener of listeners) {
    listener();
  }
}

function subscribe(key: string, listener: () => void) {
  let listeners = subscribers.get(key);

  if (!listeners) {
    listeners = new Set();
    subscribers.set(key, listeners);
  }

  listeners.add(listener);

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      subscribers.delete(key);
    }
  };
}

/**
 * Drops the least recently written entries once the map is over its bound,
 * skipping anything a mounted component is reading - evicting one of those
 * would blank a panel that is on screen and send it back to a loading state.
 */
function evictOverflow() {
  if (entries.size <= MAX_CACHED_QUERIES) return;

  for (const key of [...entries.keys()]) {
    if (entries.size <= MAX_CACHED_QUERIES) break;
    if (subscribers.get(key)?.size) continue;

    entries.delete(key);
  }
}

// Monotonic across every entry, so a record's dataVersion can be captured and
// compared without holding on to the record itself.
let dataWrites = 0;

function writeRecord(key: string, patch: Partial<QueryRecord<unknown>>) {
  const next = { ...readRecord(key), ...patch };

  if ("data" in patch) {
    dataWrites += 1;
    next.dataVersion = dataWrites;
  }

  // Deleted before it is set so the map's insertion order is write order,
  // which is the recency order evictOverflow walks.
  entries.delete(key);
  entries.set(key, next);
  evictOverflow();
  notify(key);
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

/**
 * Fetches a url, or joins the request already in the air for it. Two panels
 * mounting against the same url in the same tick make one request, and so does
 * a hover prefetch that the click then catches up with.
 */
function runQuery<T>(key: string, url: string): Promise<T | null> {
  const existing = requestsInFlight.get(key) as Promise<T | null> | undefined;

  if (existing) return existing;

  const requestGeneration = cacheGeneration;
  // What this read is answering about. A mutation that lands while it is in the
  // air moves this on, and its answer is the newer truth: writing this response
  // over it would put the row the user has just changed back on screen until
  // something else happened to refetch. That is how a menu item removed while a
  // background refresh was in flight came back a moment later.
  const readingVersion = readRecord(key).dataVersion;

  writeRecord(key, { isFetching: true });

  const request = authenticatedFetch(url)
    .then(readJson<T>)
    .then((data) => {
      if (requestGeneration !== cacheGeneration) return data;

      if (readRecord(key).dataVersion !== readingVersion) {
        writeRecord(key, { isFetching: false });

        return data;
      }

      writeRecord(key, {
        data,
        error: null,
        updatedAt: Date.now(),
        isFetching: false
      });

      return data;
    })
    .catch((error: unknown) => {
      if (requestGeneration === cacheGeneration) {
        // A refresh that fails leaves the cached rows on screen and says
        // nothing, because replacing a working panel with an error page is a
        // worse answer than showing data a couple of minutes old. With nothing
        // cached there is only the error to show.
        writeRecord(key, {
          error: readRecord(key).data
            ? null
            : error instanceof Error
              ? error.message
              : "Unable to load data.",
          isFetching: false
        });
      }

      return null;
    })
    .finally(() => {
      requestsInFlight.delete(key);
    });

  requestsInFlight.set(key, request);

  return request;
}

function isFresh(key: string, staleTime: number) {
  const record = readRecord(key);

  return record.updatedAt > 0 && Date.now() - record.updatedAt < staleTime;
}

/**
 * Marks every cached copy of a url stale and refreshes the ones on screen.
 *
 * The entry is aged rather than deleted so a mounted panel keeps its rows while
 * the new ones are on the way. Callers that follow this with their own
 * `refetch()` cost nothing extra - both land on the same in-flight request.
 */
export function invalidateAuthenticatedQuery(url: string) {
  const suffix = `:${url}`;
  const keys = new Set([...entries.keys(), ...subscribers.keys()]);

  for (const key of keys) {
    if (!key.endsWith(suffix)) continue;

    if (entries.has(key)) {
      writeRecord(key, { updatedAt: 0 });
    }

    if (subscribers.get(key)?.size) {
      void runQuery(key, url);
    }
  }
}

/**
 * Ages and refetches every cached query whose url starts with `prefix`.
 *
 * The exact-match version above cannot serve realtime invalidation: a changed
 * `events` row has to reach `/api/dashboard?startDate=...&endDate=...` and
 * `/api/events/<id>` as well as the bare endpoints, and the caller knows only
 * which table moved. Matching on the prefix covers the query strings and path
 * parameters without the realtime layer having to know what they are.
 */
export function invalidateAuthenticatedQueryPrefix(prefix: string) {
  const keys = new Set([...entries.keys(), ...subscribers.keys()]);

  for (const key of keys) {
    // The key is `${userId}:${organizationId}:${url}`, so the url starts after
    // the second colon. Matching the raw key would let an organization id that
    // happened to begin with "/api" collide.
    const url = key.slice(key.indexOf(":", key.indexOf(":") + 1) + 1);
    if (!url.startsWith(prefix)) continue;

    if (entries.has(key)) {
      writeRecord(key, { updatedAt: 0 });
    }

    if (subscribers.get(key)?.size) {
      void runQuery(key, url);
    }
  }
}

/**
 * Writes a payload the caller already holds into the cache, as though a GET had
 * just returned it.
 *
 * This is the difference between a mutation that costs one request and one that
 * costs two: a write endpoint that answers with the whole updated record leaves
 * nothing to go back and re-read. Every mounted reader of the url picks the new
 * value up.
 */
export function setAuthenticatedQueryData<T>(url: string, data: T) {
  writeRecord(queryKeyFor(url), {
    data,
    error: null,
    updatedAt: Date.now()
  });
}

/**
 * Warms a url before anything asks for it - on hover, on focus, on whatever
 * says the user is about to need it. Does nothing when the cache is already
 * fresh or a request is in the air, so it is safe to call on every pointer
 * event.
 *
 * Resolves when there is something in the cache. Most callers fire and forget;
 * the promise is there for the ones that want to wait.
 */
export function prefetchAuthenticatedQuery(
  url: string,
  options: { staleTime?: number } = {}
): Promise<void> {
  const key = queryKeyFor(url);

  if (isFresh(key, options.staleTime ?? DEFAULT_STALE_TIME_MS)) {
    return Promise.resolve();
  }

  const request =
    (requestsInFlight.get(key) as Promise<unknown> | undefined) ??
    runQuery(key, url);

  return request.then(() => undefined);
}

export function clearAuthenticatedQueryCache() {
  cacheGeneration += 1;
  entries.clear();
  requestsInFlight.clear();

  for (const key of [...subscribers.keys()]) {
    notify(key);
  }
}

export function useAuthenticatedQuery<T>(
  url: string,
  enabled = true,
  options: { staleTime?: number } = {}
) {
  const staleTime = options.staleTime ?? DEFAULT_STALE_TIME_MS;
  const key = queryKeyFor(url);
  const record = useSyncExternalStore(
    useCallback((listener: () => void) => subscribe(key, listener), [key]),
    useCallback(() => readRecord(key), [key]),
    readServerRecord
  ) as QueryRecord<T>;

  useEffect(() => {
    if (!enabled) return;
    if (isFresh(key, staleTime)) return;

    void runQuery<T>(key, url);
  }, [enabled, key, staleTime, url]);

  const refetch = useCallback(
    () => (enabled ? runQuery<T>(key, url) : Promise.resolve(null)),
    [enabled, key, url]
  );

  return {
    data: enabled ? record.data : null,
    error: enabled ? record.error : null,
    // Nothing to draw yet. A cached panel being revalidated reports false here
    // and true on isFetching, so it never drops back to a skeleton.
    isLoading: enabled && record.data === null && record.error === null,
    isFetching: enabled && record.isFetching,
    /// When the data on screen was last read from the server, as an epoch, or 0
    /// when nothing has been read yet. The cache has always tracked this to
    /// answer `isFresh`; it is returned so a screen can say it out loud, which
    /// is the difference between a board that is quiet because nothing has
    /// changed and one that is quiet because it stopped listening.
    updatedAt: enabled ? record.updatedAt : 0,
    refetch
  };
}
