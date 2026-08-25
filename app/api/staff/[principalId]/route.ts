import { z } from "zod";
import { updateStaffProfile } from "@/features/administration/server/staff-route-handlers";
import { createApiErrorResponse } from "@/lib/http/api-error";

/**
 * A person's profile - name, phone, department, title.
 *
 * Addressed by PRINCIPAL id rather than user id: the principal is the tenant's
 * handle on this person, and it is the same identifier every /api/access
 * endpoint uses. A user id would be the one identifier that spans tenants, which
 * is exactly the shape of the bug the global `users.role` column caused.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ principalId: string }> }
) {
  try {
    const { principalId } = await context.params;

    return await updateStaffProfile(
      request,
      z.string().uuid().parse(principalId)
    );
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
