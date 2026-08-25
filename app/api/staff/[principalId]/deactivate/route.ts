import { z } from "zod";
import { setStaffActive } from "@/features/administration/server/staff-route-handlers";
import { createApiErrorResponse } from "@/lib/http/api-error";

/**
 * Revoke, or restore, one person's access to this organization.
 *
 * POST rather than DELETE, and a body flag rather than two endpoints: restoring
 * somebody is the same act with the same guards and the same audit shape, and
 * splitting it in two is how one half acquires a check the other lacks.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ principalId: string }> }
) {
  try {
    const { principalId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      isActive?: unknown;
    };

    return await setStaffActive(
      request,
      z.string().uuid().parse(principalId),
      body.isActive === true
    );
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
