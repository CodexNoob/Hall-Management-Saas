import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthorizationError } from "@/lib/auth/errors";
import { formatZodErrorMessage } from "@/lib/http/zod-error-message";
import { BillingError } from "@/features/billing/services/billing-error";
import { BookingError } from "@/features/bookings/services/booking.service";

export function createApiErrorResponse(error: unknown) {
  if (error instanceof BookingError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      { error: error.message },
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

  console.error(error);
  return NextResponse.json(
    { error: "An unexpected server error occurred." },
    { status: 500 }
  );
}
