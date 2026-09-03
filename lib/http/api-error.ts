import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthorizationError } from "@/lib/auth/errors";
import { formatZodErrorMessage } from "@/lib/http/zod-error-message";
import { BillingError } from "@/features/billing/services/billing-error";
import {
  BookingError,
  isWriteConflictError
} from "@/features/bookings/services/booking.service";
import { getRequestId, log } from "@/lib/logging/context";

/**
 * Every `return` in this file goes through here.
 *
 * `getRequestId()` is null until the calling route runs inside a request scope,
 * so today this is a no-op and the header is simply absent. That is the point:
 * the call sites are correct from this edit onward, and nobody reopens 65
 * routes to collect the benefit when the scope is switched on.
 *
 * Safe because every response here is freshly built by `NextResponse.json` and
 * its headers are mutable. Headers on a response that came back from `fetch()`
 * are guarded and `.set` on one throws - so if a branch is ever added that
 * forwards an upstream response, clone it first.
 */
function withRequestId(response: NextResponse) {
  const requestId = getRequestId();

  if (requestId) response.headers.set("x-request-id", requestId);

  return response;
}

/**
 * The handled branches keep their status and their body byte for byte. What
 * they no longer keep is their silence: every one of them was invisible before
 * this, which meant the 400s, 403s and 409s - the failures a venue actually
 * calls about - left no trace at all. They log at a level that says "expected"
 * so they cannot bury the genuine 500s.
 */
export function createApiErrorResponse(error: unknown) {
  if (error instanceof BookingError) {
    log.warn(
      { code: error.code, status: error.status, kind: "BookingError" },
      "handled_route_error"
    );
    return withRequestId(
      NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      )
    );
  }
  if (error instanceof AuthorizationError) {
    // The single fastest answer to "why can't my staff member see this", which
    // is why the code is logged and the message is not: the code distinguishes
    // `not_entitled` (plan) from `not_permitted` (grant), and those have
    // completely different fixes. `details` is deliberately not logged - it is
    // shaped by the caller and could carry anything.
    log.warn(
      { code: error.code ?? null, status: error.status, kind: "AuthorizationError" },
      "handled_route_error"
    );
    // `code` and `details` are omitted rather than sent as null when absent, so
    // the ~40 pre-`lib/authz` throws keep their existing wire shape byte for
    // byte and no client has to learn a new nullable field.
    return withRequestId(
      NextResponse.json(
        {
          error: error.message,
          ...(error.code ? { code: error.code } : {}),
          ...(error.details ? { details: error.details } : {})
        },
        { status: error.status }
      )
    );
  }
  if (error instanceof BillingError) {
    log.warn(
      { code: error.code, status: error.status, kind: "BillingError" },
      "handled_route_error"
    );
    return withRequestId(
      NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      )
    );
  }

  if (error instanceof ZodError) {
    const issues = error.flatten();
    // The FIELD NAMES only. The issues themselves quote the rejected input,
    // which is user data and has no business leaving the response.
    log.info(
      { fields: Object.keys(issues.fieldErrors), status: 400, kind: "ZodError" },
      "handled_route_error"
    );
    // Naming the offending field turns a dead-end "Invalid request." into
    // something the user can actually correct.
    return withRequestId(
      NextResponse.json(
        { error: formatZodErrorMessage(issues), issues },
        { status: 400 }
      )
    );
  }

  if (error instanceof SyntaxError) {
    log.info({ status: 400, kind: "SyntaxError" }, "handled_route_error");
    return withRequestId(
      NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400 }
      )
    );
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    log.info({ code: "P2025", status: 404, kind: "Prisma" }, "handled_route_error");
    return withRequestId(
      NextResponse.json(
        { error: "Requested record was not found." },
        { status: 404 }
      )
    );
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    log.warn({ code: "P2002", status: 409, kind: "Prisma" }, "handled_route_error");
    return withRequestId(
      NextResponse.json(
        { error: "A record with the same provider reference already exists." },
        { status: 409 }
      )
    );
  }

  // Two transactions Postgres could not order against each other. The caller
  // resending it is the fix, so it is a 409 - a 500 tells them to give up on
  // something that would have worked on the next try.
  if (isWriteConflictError(error)) {
    log.warn(
      { code: "WRITE_CONFLICT", status: 409, kind: "WriteConflict" },
      "handled_route_error"
    );
    return withRequestId(
      NextResponse.json(
        {
          error: "That request collided with another write. Please try again.",
          code: "WRITE_CONFLICT"
        },
        { status: 409 }
      )
    );
  }

  // The "we did not anticipate this" branch. The stack is the whole point, and
  // it is the one thing `console.error` did give us - structured now, so it can
  // be filtered by service, release and eventually tenant.
  //
  // No Sentry here yet: Phase 1 ships with no vendor account, so the capture
  // and its `sentryId` join field arrive in Phase 2.
  log.error(
    {
      err:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : { name: "NonError", message: String(error) },
      status: 500
    },
    "unhandled_route_error"
  );

  return withRequestId(
    NextResponse.json(
      { error: "An unexpected server error occurred." },
      { status: 500 }
    )
  );
}
