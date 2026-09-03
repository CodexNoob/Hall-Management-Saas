import { NextResponse } from "next/server";
import { z } from "zod";
import { log } from "@/lib/logging/context";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { withRoute } from "@/lib/http/with-route";
import { recordAndNotifyBetaAccessRequest } from "@/features/beta-access/server/beta-access";

/**
 * Records a beta-access request at the moment somebody registers.
 *
 * UNAUTHENTICATED BY NECESSITY. With email confirmation on, `supabase.auth.
 * signUp` returns no session, so there is no credential to present - the
 * applicant is not signed in and will not be until they are approved. Same
 * shape as POST /api/support/contact and POST /api/newsletter/subscribe:
 * rate-limited, honeypotted, writing one row to a table that has no tenant and
 * grants nothing.
 *
 * NOT AN APPROVAL ENDPOINT, and there is deliberately no such thing. This route
 * can only ever create a PENDING row; the only writer of APPROVED is the
 * approval script, which runs against DATABASE_URL. Nothing reachable over HTTP
 * can raise a request's status.
 *
 * What the open surface costs, stated plainly: anyone can post an address and
 * cause one PENDING row and one email to BETA_APPROVAL_EMAIL. The row confers
 * nothing - `provisionOwner` refuses anything that is not APPROVED - so the
 * exposure is inbox noise, bounded by the limiter, identical to what the public
 * contact form already carries.
 *
 * NOT THE GATE either. This only records. `lib/auth/provisioning.ts` refuses,
 * and records too, so removing this route would cost the promptness of the
 * notification and nothing else.
 */

const betaAccessRequestSchema = z
  .object({
    email: z.string().trim().email().max(254),
    /**
     * Which button they pressed. Client-supplied and therefore never an input
     * to a decision - it is a label on a notification email. The Google path
     * does not use this route at all; its method is read server-side off the
     * Supabase identity.
     */
    signupMethod: z.enum(["email_password", "google"]).optional(),
    /** Honeypot. Real browsers leave it empty; scripts fill everything in. */
    website: z.string().max(0).optional()
  })
  .strict();

/**
 * ONE ANSWER FOR EVERY ADDRESS.
 *
 * The same status and the same body whether the request is brand new, already
 * pending, already rejected, or belongs to somebody who has had an account for
 * months. Anything that varied - a different code, a different message - would
 * make this an oracle for "does this person use Event Core". The applicant
 * learns what happens next from the page they are sent to, not from here.
 */
const UNIFORM_RESPONSE = { status: "received" } as const;

export const POST = withRoute(
  "POST /api/beta-access/requests",
  async (request: Request) => {
    try {
      const limited = await enforceRateLimit(request, {
        scope: "beta-access-request",
        limit: 5,
        windowMs: 10 * 60 * 1000
      });
      if (limited) return limited;

      const input = betaAccessRequestSchema.parse(await request.json());

      await recordAndNotifyBetaAccessRequest({
        email: input.email,
        signupMethod: input.signupMethod ?? "email_password"
      });

      return NextResponse.json(UNIFORM_RESPONSE, { status: 202 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Please enter a valid email address." },
          { status: 400 }
        );
      }

      log.error(
        {
          err:
            error instanceof Error
              ? { name: error.name, message: error.message, stack: error.stack }
              : { name: "NonError", message: String(error) },
          status: 500
        },
        "beta_access_request_failed"
      );

      return NextResponse.json(
        { error: "We could not record your request. Please try again." },
        { status: 500 }
      );
    }
  }
);
