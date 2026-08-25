import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authz/authorize";
import { createRole, listRoles, readEpoch } from "@/lib/authz/admin/roles";
import { parseEpochPrecondition, parsePermissionKeys } from "@/lib/authz/guards";
import { createApiErrorResponse } from "@/lib/http/api-error";

/**
 * Roles. Reading them is `role.read`; AUTHORING them is `role.manage`.
 *
 * That split is what makes Owner and Administrator genuinely different roles
 * rather than the same matrix at two ranks - and it is expressed entirely in
 * `role_permissions` rows, so no code here knows either name (INV-1).
 */

const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(80),
  key: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]*$/, "A key is lowercase letters, digits and dashes.")
    .max(60)
    .optional(),
  description: z.string().trim().max(300).nullish(),
  /**
   * Sparse on purpose (the starter five are 100/200/300/400/500), so a tenant
   * can slot "Front Desk" in at 350 without renumbering anything.
   */
  rank: z.number().int().min(1).max(100_000),
  permissions: z.array(z.string())
});

export async function GET(request: Request) {
  try {
    const actor = await authorize(request, "role.read");

    return NextResponse.json({
      roles: await listRoles(actor),
      epoch: actor.epoch
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await authorize(request, "role.manage");
    const expectedEpoch = parseEpochPrecondition(request);
    const input = createRoleSchema.parse(await request.json());

    const role = await createRole(actor, {
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      rank: input.rank,
      // Validated against the catalog rather than trusted, and REFUSED rather
      // than filtered: silently dropping an unknown key means an administrator
      // ticks a box, sees it save, and finds it unticked next time.
      permissions: parsePermissionKeys(input.permissions),
      expectedEpoch
    });

    return NextResponse.json(
      { data: role, epoch: await readEpoch(actor.organizationId) },
      { status: 201 }
    );
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
