import { NextResponse } from "next/server";
import { authorize } from "@/lib/authz/authorize";
import { expireOrganizationHolds } from "@/features/bookings/services/booking.service";
import { createApiErrorResponse } from "@/lib/http/api-error";

// Safe to call from an authenticated scheduler/heartbeat. Event reads and writes
// also expire holds, so availability never depends on this endpoint running first.
export async function POST(request: Request) {
  try {
    const actor = await authorize(request, "booking.cancel");
    const expiredCount = await expireOrganizationHolds(actor.organizationId);
    return NextResponse.json({ expiredCount });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
