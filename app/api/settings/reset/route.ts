import { NextResponse } from "next/server";
import { z } from "zod";

import { authorize, requireUserActor } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import {
  RESET_CONFIRMATIONS,
  RESET_SCOPES
} from "@/features/settings/lib/organization-reset-scopes";
import { resetOrganization } from "@/features/settings/server/organization-reset";

const resetSchema = z.object({
  scope: z.enum(RESET_SCOPES),
  /**
   * The words the person typed, checked here as well as in the dialog.
   *
   * The client's confirmation is a courtesy to whoever is about to lose their
   * data; this one is the actual gate. A scope's phrase is specific to it, so a
   * request that names one scope and confirms another is refused rather than
   * quietly performing the scope it was sent.
   */
  confirmation: z.string()
});

export async function POST(request: Request) {
  try {
    // Its own key, not `settings.update`: this is the one act in the catalog
    // with nothing to undo it. `requireUserActor` because a service account has
    // no membership, and this needs a person to keep signed in afterwards - and
    // somebody to name in the audit entry.
    const actor = await authorize(request, "organization.reset");
    const userId = requireUserActor(actor);
    const input = resetSchema.parse(await request.json());

    if (input.confirmation.trim() !== RESET_CONFIRMATIONS[input.scope]) {
      return NextResponse.json(
        {
          error: `Type ${RESET_CONFIRMATIONS[input.scope]} to confirm this reset.`
        },
        { status: 400 }
      );
    }

    const outcome = await resetOrganization({
      organizationId: actor.organizationId,
      actorUserId: userId,
      scope: input.scope
    });

    return NextResponse.json(outcome);
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
