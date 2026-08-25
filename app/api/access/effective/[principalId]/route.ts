import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authz/authorize";
import { effectiveReport } from "@/lib/authz/admin/effective";
import { createApiErrorResponse } from "@/lib/http/api-error";

/**
 * The resolver's own answer, with provenance per key.
 *
 * This is what makes "why can they do that?" answerable, and it is the reason
 * the whole design is operable rather than merely correct. Without it the only
 * way to explain a permission is to read four tables and take the union by hand
 * - which is exactly the moment somebody decides it is easier to give the person
 * Owner and move on.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ principalId: string }> }
) {
  try {
    const actor = await authorize(request, "role.read");
    const { principalId } = await context.params;

    return NextResponse.json({
      data: await effectiveReport(
        actor.organizationId,
        z.string().uuid().parse(principalId)
      ),
      epoch: actor.epoch
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
