import { NextResponse } from "next/server";
import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { getDriveStatus } from "@/lib/google/drive";
import { withRoute } from "@/lib/http/with-route";

/**
 * Whether Drive mirroring is switched on for this deployment.
 *
 * The Files page used to render a hardcoded "Google Drive sync ready" badge
 * whether or not anything was connected. This is what replaces it, so the
 * badge reflects the deployment instead of asserting a capability.
 *
 * Only the names of missing settings are returned, never their values.
 */
export const GET = withRoute(
  "GET /api/integrations/google-drive",
  async (request: Request) => {
    try {
      await authorize(request, "file.read");
      const status = getDriveStatus();

      return NextResponse.json({
        configured: status.configured,
        missing: status.missing
      });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
