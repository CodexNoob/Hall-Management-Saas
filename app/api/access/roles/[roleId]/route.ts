import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authz/authorize";
import { deleteRole, readEpoch, updateRole } from "@/lib/authz/admin/roles";
import { parseEpochPrecondition, parsePermissionKeys } from "@/lib/authz/guards";
import { createApiErrorResponse } from "@/lib/http/api-error";

/**
 * Editing and deleting one role.
 *
 * `key` is deliberately not accepted. A role's key is its stable identity - the
 * seed finds its own rows by it and every audit entry quotes it - so renaming
 * one would silently orphan both. The NAME is freely editable, and it is the
 * only thing anyone sees.
 */

const updateRoleSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(300).nullish(),
  rank: z.number().int().min(1).max(100_000).optional(),
  /** Replaces the whole set. Idempotent, and the diff is what the audit records. */
  permissions: z.array(z.string()).optional()
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ roleId: string }> }
) {
  try {
    const actor = await authorize(request, "role.manage");
    const expectedEpoch = parseEpochPrecondition(request);
    const { roleId } = await context.params;
    const input = updateRoleSchema.parse(await request.json());

    const role = await updateRole(actor, z.string().uuid().parse(roleId), {
      name: input.name,
      description: input.description,
      rank: input.rank,
      permissions: input.permissions
        ? parsePermissionKeys(input.permissions)
        : undefined,
      expectedEpoch
    });

    return NextResponse.json({
      data: role,
      epoch: await readEpoch(actor.organizationId)
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ roleId: string }> }
) {
  try {
    const actor = await authorize(request, "role.manage");
    const expectedEpoch = parseEpochPrecondition(request);
    const { roleId } = await context.params;

    await deleteRole(actor, z.string().uuid().parse(roleId), expectedEpoch);

    return NextResponse.json({
      ok: true,
      epoch: await readEpoch(actor.organizationId)
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
