import { log } from "@/lib/logging/context";

/**
 * Timing and outcome for every call that leaves this process.
 *
 * The three things a ticket about a slow or failing integration needs - which
 * vendor, how long it took, what came back - on one line, joined to the rest of
 * the request by the ambient `requestId`. Without this, a payment that took
 * eleven seconds and a payment that failed instantly produce the same
 * `request_completed` line with a different duration and no attribution.
 *
 * No `server-only` marker, for the same reason `lib/logging/context.ts` carries
 * none: route tests import the handlers that import this, and the marker would
 * fail every one of them. The `log` import is the real server boundary.
 */

/**
 * Bounded on purpose. A log platform groups by this field, and a free string
 * would let one call site quietly become a thousand distinct series.
 */
// `resend` is kept although nothing targets it any more: historical log lines
// carry it, and a dashboard grouping by vendor should not lose them.
type Vendor =
  | "stripe"
  | "plaid"
  | "google"
  | "resend"
  | "brevo"
  | "webhook"
  | "supabase";

export type OutboundCall = {
  vendor: Vendor;
  /**
   * Stable and low-cardinality - `checkout/sessions`, `calendar.events.insert`.
   * Never a URL and never an id: this is the field you average a duration over,
   * so a value that varies per call makes the average meaningless.
   */
  operation: string;
};

/**
 * Anything past this is worth a `warn` even when it succeeded. A partner that
 * answers in eight seconds has not failed, but it is why the request did.
 */
const SLOW_CALL_MS = 2_000;

export async function trackOutbound<T>(
  call: OutboundCall,
  run: () => Promise<T>,
  /** Optional, because an SDK call has no status to read. */
  readStatus?: (result: T) => number | undefined
): Promise<T> {
  const startedAt = performance.now();

  try {
    const result = await run();
    const durationMs = Math.round(performance.now() - startedAt);
    const status = readStatus?.(result);
    const slow = durationMs > SLOW_CALL_MS;
    // The status only. Never the response body - it is the partner's payload,
    // it is where a card number or an access token would be, and §10's rule
    // against logging bodies does not have a "but this one is a vendor" clause.
    const line = { ...call, status: status ?? null, durationMs, slow };

    if (slow || (status !== undefined && status >= 400)) {
      log.warn(line, "outbound_call_completed");
    } else {
      log.info(line, "outbound_call_completed");
    }

    return result;
  } catch (error) {
    // This is not the "do not log an error you are about to throw" case. That
    // rule exists because `createApiErrorResponse` already records the failure -
    // and it does, but it records it as a 500 from a route. It cannot say that
    // Stripe took eight seconds to refuse the call, because by then the vendor,
    // the operation and the clock are all out of scope. The two lines answer
    // different questions and share a `requestId`.
    log.warn(
      {
        ...call,
        durationMs: Math.round(performance.now() - startedAt),
        err:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { name: "NonError", message: String(error) }
      },
      "outbound_call_failed"
    );

    throw error;
  }
}

/**
 * `fetch` with the line attached, for the partners this codebase calls over raw
 * HTTP rather than through an SDK.
 *
 * The URL is passed through untouched and never logged. A partner URL carries
 * ids in its path and, for Plaid, credentials in its body; `vendor` and
 * `operation` are what a query needs and are safe by construction.
 */
export function trackedFetch(
  call: OutboundCall,
  input: string | URL,
  init?: RequestInit
): Promise<Response> {
  return trackOutbound(
    call,
    () => fetch(input, init),
    (response) => response.status
  );
}
