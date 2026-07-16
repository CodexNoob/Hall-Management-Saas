import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/server-auth";
import { expireOrganizationHolds } from "@/lib/bookings/booking-service";
import { createApiErrorResponse } from "@/lib/http/api-error";

// Safe to call from an authenticated scheduler/heartbeat. Event reads and writes
// also expire holds, so availability never depends on this endpoint running first.
export async function POST(request: Request) {
  try {
    const actor = await requirePermission(request, "canCreateBooking");
    const expiredCount = await expireOrganizationHolds(actor.organizationId);
    return NextResponse.json({ expiredCount });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
