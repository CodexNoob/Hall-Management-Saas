import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authz/authorize";
import { readOverrides, replaceOverrides } from "@/lib/authz/admin/overrides";
import { readEpoch } from "@/lib/authz/admin/roles";
import { parseEpochPrecondition, parsePermissionKeys } from "@/lib/authz/guards";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { withRoute } from "@/lib/http/with-route";

/**
 * One person's individual exceptions.
 *
 * PUT, not PATCH: the body is the full state of that principal's overrides, so
 * the operation is idempotent and unticking a box actually removes the row
 * rather than needing a separate delete call to catch up.
 *
 * `permission.override` is its own key, held by Owner and nobody else in the
 * starter set. Handing out one-off exceptions is a strictly stronger power than
 * assigning an existing role, because it is the only path that can produce a
 * grant no role explains.
 */

const overridesSchema = z.object({
  grants: z.array(z.string()).default([]),
  denies: z.array(z.string()).default([])
});

export const GET = withRoute(
  "GET /api/access/overrides/[principalId]",
  async (
  request: Request,
    context: { params: Promise<{ principalId: string }> }
  ) => {
    try {
      const actor = await authorize(request, "role.read");
      const { principalId } = await context.params;

      return NextResponse.json({
        data: await readOverrides(
          actor.organizationId,
          z.string().uuid().parse(principalId)
        ),
        epoch: actor.epoch
      });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);

export const PUT = withRoute(
  "PUT /api/access/overrides/[principalId]",
  async (
  request: Request,
    context: { params: Promise<{ principalId: string }> }
  ) => {
    try {
      const actor = await authorize(request, "permission.override");
      const expectedEpoch = parseEpochPrecondition(request);
      const { principalId } = await context.params;
      const input = overridesSchema.parse(await request.json());

      const data = await replaceOverrides(
        actor,
        z.string().uuid().parse(principalId),
        {
          grants: parsePermissionKeys(input.grants),
          denies: parsePermissionKeys(input.denies)
        },
        expectedEpoch
      );

      return NextResponse.json({
        data,
        epoch: await readEpoch(actor.organizationId)
      });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
