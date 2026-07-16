import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthorizationError } from "@/lib/auth/server-auth";
import { BookingError } from "@/lib/bookings/booking-service";

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

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request.", issues: error.flatten() },
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

  console.error(error);
  return NextResponse.json(
    { error: "An unexpected server error occurred." },
    { status: 500 }
  );
}
