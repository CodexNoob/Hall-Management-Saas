import { AsyncLocalStorage } from "node:async_hooks";
import type { Logger } from "pino";
import { baseLogger } from "@/lib/logging/logger";
import {
  bindActorToErrorScope,
  bindRequestIdToErrorScope
} from "@/lib/logging/report";

/**
 * Per-request context, carried ambiently so that a service three calls deep can
 * log a tenant-tagged line without anyone threading a logger through its
 * signature.
 *
 * See the note in `lib/logging/logger.ts` on why neither module carries
 * `server-only`. `node:async_hooks` is the real server boundary here.
 */

type RequestScope = {
  requestId: string;
  route: string;
  organizationId?: string;
  userId?: string | null;
  principalId?: string;
};

const storage = new AsyncLocalStorage<{ logger: Logger; scope: RequestScope }>();

export function runInRequestScope<T>(scope: RequestScope, fn: () => T): T {
  // The two planes get the same correlation key from one place. Sentry groups
  // by stack and the logs group by `requestId`, so without this an issue tells
  // you what broke but not which of the request's log lines belong to it.
  bindRequestIdToErrorScope(scope.requestId);

  return storage.run({ logger: baseLogger.child(scope), scope }, fn);
}

/**
 * Bind the acting principal onto the current scope, once authorization has
 * resolved it. Everything logged after this point carries the organization.
 *
 * Called from `toContext()` in `lib/authz/authorize.ts` rather than from each
 * route: that private builder is the only place an `AuthzContext` is ever
 * constructed, so both `authorize()` and `authorizeMember()` pass through it
 * and neither entry point can be forgotten.
 *
 * A no-op outside a request scope, which is how it behaves until routes are
 * wrapped: binding without a scope is not an error, it just has nowhere to go.
 */
export function bindActor(actor: {
  organizationId: string;
  userId: string | null;
  principalId: string;
}) {
  // Outside the `if` below on purpose. The error plane has its own per-request
  // isolation scope and does not depend on this module's storage, so an actor
  // resolved outside a request scope still deserves its tag - and tagging is
  // what turns "an error happened" into "this hit these three organizations".
  bindActorToErrorScope(actor);

  const store = storage.getStore();

  if (!store) return;

  Object.assign(store.scope, actor);
  store.logger = baseLogger.child(store.scope);
}

/** The current request's correlation id, or null outside a request scope. */
export function getRequestId() {
  return storage.getStore()?.scope.requestId ?? null;
}

/**
 * The import every call site uses.
 *
 * Falls back to the base logger outside a request - a cron, a seed script,
 * module initialisation - rather than throwing. A logger that can fail is a
 * logger people stop calling.
 */
export const log = {
  debug: (payload: object, message: string) =>
    (storage.getStore()?.logger ?? baseLogger).debug(payload, message),
  info: (payload: object, message: string) =>
    (storage.getStore()?.logger ?? baseLogger).info(payload, message),
  warn: (payload: object, message: string) =>
    (storage.getStore()?.logger ?? baseLogger).warn(payload, message),
  error: (payload: object, message: string) =>
    (storage.getStore()?.logger ?? baseLogger).error(payload, message)
};
