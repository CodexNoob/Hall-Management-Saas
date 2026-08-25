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

export function createApiErrorResponse(error: unknown) {
  if (error instanceof BookingError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }
  if (error instanceof AuthorizationError) {
    // `code` and `details` are omitted rather than sent as null when absent, so
    // the ~40 pre-`lib/authz` throws keep their existing wire shape byte for
    // byte and no client has to learn a new nullable field.
    return NextResponse.json(
      {
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
        ...(error.details ? { details: error.details } : {})
      },
      { status: error.status }
    );
  }
  if (error instanceof BillingError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }

  if (error instanceof ZodError) {
    const issues = error.flatten();
    // Naming the offending field turns a dead-end "Invalid request." into
    // something the user can actually correct.
    return NextResponse.json(
      { error: formatZodErrorMessage(issues), issues },
      { status: 400 }
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    return NextResponse.json(
      { error: "Requested record was not found." },
      { status: 404 }
    );
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return NextResponse.json(
      { error: "A record with the same provider reference already exists." },
      { status: 409 }
    );
  }

  // Two transactions Postgres could not order against each other. The caller
  // resending it is the fix, so it is a 409 - a 500 tells them to give up on
  // something that would have worked on the next try.
  if (isWriteConflictError(error)) {
    return NextResponse.json(
      {
        error: "That request collided with another write. Please try again.",
        code: "WRITE_CONFLICT"
      },
      { status: 409 }
    );
  }

  console.error(error);
  return NextResponse.json(
    { error: "An unexpected server error occurred." },
    { status: 500 }
  );
}
