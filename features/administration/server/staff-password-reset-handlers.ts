import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createPasswordResetLink,
  sendPasswordResetEmail
} from "@/lib/auth/password-reset";
import { authorize } from "@/lib/authz/authorize";
import { loadActorFacts, rankOfPrincipal } from "@/lib/authz/admin/context";
import { writeAudit } from "@/lib/authz/admin/audit";
import { assertRankCeiling, notFound } from "@/lib/authz/guards";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { withRoute } from "@/lib/http/with-route";
import { log } from "@/lib/logging/context";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";

/**
 * SEND SOMEBODY ELSE A PASSWORD RESET.
 *
 * For the staff member who has forgotten their password AND cannot use the
 * self-service link - a cook who never reads email, an address that no longer
 * exists. The administrator either has the reset emailed, or takes a link to
 * pass on by hand (a message, a printout).
 *
 * THE ADMINISTRATOR NEVER SETS OR SEES A PASSWORD. They hand over a way in, and
 * the person chooses their own on the Set Password screen. An admin who types
 * a password for somebody knows it afterwards, which is the thing to avoid.
 *
 * `staff.update`, the key that already lets them edit the person's profile.
 * Plus THE SAME RANK CEILING as deactivating or signing somebody out: a reset
 * is authority over the person, so an administrator cannot reset the owner.
 *
 * The target is a PRINCIPAL resolved inside the caller's own organization, and
 * the address comes from that row - never from the request.
 */
const resetSchema = z
  .object({ delivery: z.enum(["email", "link"]) })
  .strict();

export const POST = withRoute(
  "POST /api/staff/[principalId]/password-reset",
  async (
    request: Request,
    context: { params: Promise<{ principalId: string }> }
  ) => {
    try {
      const limited = await enforceRateLimit(request, {
        scope: "staff-password-reset",
        limit: 10,
        windowMs: 10 * 60 * 1000
      });
      if (limited) return limited;

      const actor = await authorize(request, "staff.update");
      const { principalId } = await context.params;
      const { delivery } = resetSchema.parse(await request.json());

      // Read and judged BEFORE anything leaves the building: a refusal here
      // must not have sent an email first.
      const { subject, facts } = await prisma.$transaction(async (transaction) => {
        const membership = await transaction.organizationMembership.findFirst({
          where: { principalId, organizationId: actor.organizationId },
          select: {
            isActive: true,
            user: {
              select: { id: true, name: true, email: true, supabaseAuthId: true }
            }
          }
        });

        if (!membership?.user) throw notFound("That staff member");

        const actorFacts = await loadActorFacts(transaction, actor);

        assertRankCeiling(
          actorFacts.rank,
          await rankOfPrincipal(transaction, principalId, actor.organizationId),
          "act"
        );

        return {
          subject: { ...membership.user, isActive: membership.isActive },
          facts: actorFacts
        };
      });

      if (!subject.isActive) {
        return NextResponse.json(
          { error: "This person's access is switched off. Restore it before resetting their password." },
          { status: 409 }
        );
      }

      if (!subject.supabaseAuthId) {
        return NextResponse.json(
          { error: "This person has not accepted their invitation yet. Send the invitation again instead." },
          { status: 409 }
        );
      }

      let emailSent = false;
      let link: string | null = null;
      let emailError: string | null = null;

      if (delivery === "email") {
        emailError = (await sendPasswordResetEmail(subject.email)).error;
        emailSent = !emailError;

        // Mail refused - usually Supabase's hourly quota. Downgrade to a link
        // the administrator can pass on, exactly as invitations do.
        if (!emailSent) link = await createPasswordResetLink(subject.email);
      } else {
        link = await createPasswordResetLink(subject.email);
      }

      if (!emailSent && !link) {
        return NextResponse.json(
          { error: emailError ?? "A reset link could not be created. Try again." },
          { status: 502 }
        );
      }

      await prisma.$transaction((transaction) =>
        writeAudit(transaction, facts, {
          action: "staff.password.reset",
          subjectPrincipalId: principalId,
          subjectName: subject.name,
          detail: { delivery: emailSent ? "email" : "link" }
        })
      );

      log.info(
        { delivery, emailSent, fellBackToLink: delivery === "email" && !emailSent },
        "staff_password_reset_issued"
      );

      return NextResponse.json({ emailSent, link, emailError });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
