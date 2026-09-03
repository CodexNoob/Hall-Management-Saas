import "server-only";
import { randomUUID } from "node:crypto";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { log, runInRequestScope } from "@/lib/logging/context";

/**
 * Referenced by the completion line below, so it has to actually exist.
 *
 * 1 = keep everything. Sampling is a cost control for volume this application
 * does not have yet, and a rate below 1 pre-launch mostly hides the request you
 * are trying to debug. Turn it down when the volume model says the bill needs
 * it - and note that only fast successful reads are ever thinned.
 */
const READ_SAMPLE_RATE = 1;

/**
 * The shape a request id is allowed to have when the caller supplies one.
 *
 * Deliberately narrow. The inbound header is caller-controlled and this value
 * lands in every log line AND goes back out as a response header, so an
 * unvalidated one is log injection and a forgeable correlation key at the same
 * time. Anything that is not shaped like something we would have minted is
 * discarded rather than sanitised - a rejected id costs a fresh uuid, and a
 * sanitised one silently keeps whatever survived the filter.
 */
const CLAIMED_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

/**
 * Wraps a route handler so a request id, a completion line and a duration exist
 * without each of the 71 route files remembering to add them.
 *
 * The `route` argument is passed explicitly rather than inferred from the
 * request: the value that makes a log searchable is the route PATTERN, and
 * `request.url` has the ids already substituted into it - a thousand distinct
 * paths where there is one endpoint.
 */
export function withRoute<TContext = unknown>(
  route: string,
  handler: (request: Request, context: TContext) => Promise<Response>
) {
  // `Request`, not `NextRequest`, and `context` OPTIONAL. Both are forced by the
  // test suite: the unit files call these handlers directly as
  // `PATCH(new Request("http://localhost/api/halls", { ... }))` - one argument,
  // a plain Request. Narrowing either parameter breaks all of them at once.
  //
  // Assignability against Next's generated route validator, which wants
  // `(NextRequest, { params: Promise<...> })`, still holds: parameters are
  // checked contravariantly, so the wider types are accepted.
  return async function (
    request: Request,
    context?: TContext
  ): Promise<Response> {
    const claimed = request.headers.get("x-request-id");
    const vercelId = request.headers.get("x-vercel-id");
    const requestId =
      (claimed && CLAIMED_ID_PATTERN.test(claimed) ? claimed : "") ||
      // Links the line back to Vercel's own log view. Vercel's format is
      // `region::hash-timestamp-hash`, so colons survive this filter where the
      // caller-supplied pattern above rejects them.
      (vercelId ? vercelId.slice(0, 64).replace(/[^A-Za-z0-9:-]/g, "") : "") ||
      randomUUID();
    const startedAt = performance.now();

    // NEVER read `request.body` here - not for a size, not for a shape.
    // `app/api/billing/stripe/webhook/route.ts` does `await request.text()` and
    // feeds that exact string to signature verification. A wrapper that consumes
    // the stream turns every Stripe webhook into a 400.
    return runInRequestScope({ requestId, route }, async () => {
      try {
        const response = await handler(request, context as TContext);

        // One line per request, and the backbone of the whole diagnostic plane.
        // "Sample reads, keep every write" is a rule with no mechanism unless it
        // lives right here, so here it is: mutations, slow calls and anything
        // that failed are always kept, and only fast successful reads are
        // thinned - the twenty-odd requests a dashboard load fans out into.
        const durationMs = Math.round(performance.now() - startedAt);
        const isRead = request.method === "GET" || request.method === "HEAD";
        const rate = isRead ? READ_SAMPLE_RATE : 1;
        const keep =
          !isRead ||
          response.status >= 400 ||
          durationMs > 1_000 ||
          Math.random() < rate;

        // `sampleRate` rides along on purpose: without it a count in the log
        // platform is a count of what survived, not of what happened.
        if (keep) {
          log.info(
            {
              method: request.method,
              status: response.status,
              durationMs,
              sampleRate: rate
            },
            "request_completed"
          );
        }

        // Safe only because every route builds its own response - either
        // `NextResponse.json` or `new NextResponse` for the PDF and audit-CSV
        // routes - and those headers are mutable. Headers on a response that came
        // back from `fetch()` are guarded and `.set` on one throws. No handler
        // returns a fetch response unwrapped today (the Plaid routes parse the
        // JSON first); keep it that way, or clone before returning.
        response.headers.set("x-request-id", requestId);

        return response;
      } catch (error) {
        // The existing per-route try/catch blocks keep working untouched; this
        // only catches what escapes them, and answers identically.
        return createApiErrorResponse(error);
      }
    });
  };
}
