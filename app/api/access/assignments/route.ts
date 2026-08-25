import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authz/authorize";
import { createAssignment } from "@/lib/authz/admin/assignments";
import { readEpoch } from "@/lib/authz/admin/roles";
import { parseEpochPrecondition } from "@/lib/authz/guards";
import { SCOPE_TYPES } from "@/lib/authz/types";
import { createApiErrorResponse } from "@/lib/http/api-error";

/**
 * Putting somebody into a role.
 *
 * `role.assign`, not `role.manage`: an Administrator may put people into roles
 * that already exist without being able to author new ones. That is the whole
 * difference between the two starter roles at the top, and it is a permission
 * row rather than a branch in this file.
 */

const createAssignmentSchema = z.object({
  principalId: z.string().uuid(),
  roleId: z.string().uuid(),
  scope: z
    .object({
      type: z.enum(SCOPE_TYPES),
      id: z.string().uuid().optional()
    })
    .default({ type: "org" }),
  /**
   * Time-boxed elevation needs no other machinery: the resolver evaluates this
   * in its own query, so the assignment stops granting at the moment it lapses
   * even if nothing has cleaned it up.
   */
  expiresAt: z.string().datetime().nullish()
});

export async function POST(request: Request) {
  try {
    const actor = await authorize(request, "role.assign");
    const expectedEpoch = parseEpochPrecondition(request);
    const input = createAssignmentSchema.parse(await request.json());

    const assignment = await createAssignment(actor, {
      principalId: input.principalId,
      roleId: input.roleId,
      scope: input.scope,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      expectedEpoch
    });

    return NextResponse.json(
      { data: assignment, epoch: await readEpoch(actor.organizationId) },
      { status: 201 }
    );
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
