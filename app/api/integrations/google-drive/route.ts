import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { getDriveStatus } from "@/lib/google/drive";

/**
 * Whether Drive mirroring is switched on for this deployment.
 *
 * The Files page used to render a hardcoded "Google Drive sync ready" badge
 * whether or not anything was connected. This is what replaces it, so the
 * badge reflects the deployment instead of asserting a capability.
 *
 * Only the names of missing settings are returned, never their values.
 */
export async function GET(request: Request) {
  try {
    await requirePermission(request, "canViewEventManager");
    const status = getDriveStatus();

    return NextResponse.json({
      configured: status.configured,
      missing: status.missing
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
