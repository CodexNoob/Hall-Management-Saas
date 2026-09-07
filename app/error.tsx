"use client";

import { useEffect, useState } from "react";
import { captureException } from "@/lib/logging/report";

/**
 * The boundary that did not exist before this.
 *
 * A render crash below the root layout used to show Next's default screen and
 * tell nobody - no log line, no report, and nothing for the user to quote. It
 * wraps every page, loading and nested layout in the tree; the root layout
 * itself is above it, which is what `global-error.tsx` is for.
 *
 * Error boundaries have to be Client Components, so this cannot use the `log`
 * facade - `lib/logging/context.ts` imports `node:async_hooks`. The Sentry
 * facade is isomorphic precisely so this file has something to call.
 */
export default function AppError({
  error,
  retry
}: {
  error: Error & { digest?: string };
  // `retry` rather than `reset`. Next 16.3 made this prop stable, and unlike
  // `reset` it re-fetches before re-rendering - which is what the user pressing
  // "Try again" actually wants after a failed server render.
  retry: () => void;
}) {
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    setEventId(captureException(error));
  }, [error]);

  /*
   * Two different ids, and which one exists tells you where the error came
   * from. `digest` is minted by React for an error thrown while rendering on
   * the server, and it is the field `instrumentation.ts` puts on the
   * `request_error` log line - so it joins the screenshot to the log stream and
   * is worth more than the Sentry id when both are present. A crash in the
   * browser has no digest, and then the Sentry event id is the only handle
   * anyone has.
   */
  const reference = error.digest ?? eventId;

  return (
    <main className="flex min-h-dvh items-center justify-center overflow-x-hidden bg-white px-6 text-[#0F172A]">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-3 text-sm text-[#475569]">
          This page failed to load. The problem has been reported. You can try
          again, and if it keeps happening send us the reference below.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-6 rounded-lg bg-[#0F172A] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F172A]"
        >
          Try again
        </button>
        {reference ? (
          // Selectable, wrapping and monospaced, matching how the error toast
          // renders a request id: its only job is to be copied or read out.
          <p className="mt-6 font-mono text-[11px] break-all text-[#64748B]">
            Reference: {reference}
          </p>
        ) : null}
      </div>
    </main>
  );
}
