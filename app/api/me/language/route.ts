import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeMember, requireUserActor } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { SUPPORTED_LOCALES } from "@/lib/i18n/messages";
import { log } from "@/lib/logging/context";
import { prisma } from "@/lib/prisma";
import { withRoute } from "@/lib/http/with-route";

/**
 * The signed-in person's own dashboard language.
 *
 * Deliberately NOT behind `settings.update`, and deliberately not part of
 * `/api/settings` at all. That endpoint changes the ORGANIZATION's language and
 * needs the permission to match, and `/dashboard/settings` is itself gated on
 * `settings.read` - which the people this feature is for do not have. A kitchen
 * worker who reads Spanish is exactly the person who cannot open Settings, so a
 * preference about their own screen cannot live behind it.
 *
 * `authorizeMember` is the whole check: belonging to the organization is the
 * only thing being asked, because the only row this can write is the caller's
 * own, and choosing your own language escalates nothing.
 */
const languageSchema = z.object({
  // Null is "follow the organization", which is a choice a person can make
  // again after having set one - so it is accepted rather than only being the
  // initial state.
  language: z
    .enum(SUPPORTED_LOCALES as unknown as [string, ...string[]])
    .nullable()
});

export const PATCH = withRoute(
  "PATCH /api/me/language",
  async (request: Request) => {
    try {
      const actor = await authorizeMember(request);
      // A machine caller has no user row and so has no screen to set a language
      // for. `requireUserActor` refuses it rather than inventing an owner.
      const userId = requireUserActor(actor);
      const input = languageSchema.parse(await request.json());

      await prisma.user.update({
        where: { id: userId },
        data: { language: input.language }
      });

      // Worth a line: it is the one setting that changes what somebody sees
      // without anything else in the organization changing, so a "the dashboard
      // came up in the wrong language" report is otherwise unreconstructable.
      log.info(
        { followsOrganization: input.language === null },
        "user_language_updated"
      );

      return NextResponse.json({ language: input.language });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
