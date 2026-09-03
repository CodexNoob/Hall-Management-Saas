import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authz/authorize";
import { revokeAssignment } from "@/lib/authz/admin/assignments";
import { readEpoch } from "@/lib/authz/admin/roles";
import { parseEpochPrecondition } from "@/lib/authz/guards";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { withRoute } from "@/lib/http/with-route";

/**
 * Revoking one assignment, addressed by its own id.
 *
 * NOT nested under the principal. An assignment is a resource with an identity,
 * and "revoke the Hall A one and keep the Hall B one" has to be expressible -
 * nesting would put redundant identity in the URL and still leave the scope
 * ambiguous.
 */
export const DELETE = withRoute(
  "DELETE /api/access/assignments/[assignmentId]",
  async (
  request: Request,
    context: { params: Promise<{ assignmentId: string }> }
  ) => {
    try {
      const actor = await authorize(request, "role.assign");
      const expectedEpoch = parseEpochPrecondition(request);
      const { assignmentId } = await context.params;

      await revokeAssignment(
        actor,
        z.string().uuid().parse(assignmentId),
        expectedEpoch
      );

      return NextResponse.json({
        ok: true,
        epoch: await readEpoch(actor.organizationId)
      });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
