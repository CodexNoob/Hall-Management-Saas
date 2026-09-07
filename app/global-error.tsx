"use client";

import { useEffect, useState } from "react";
import { captureException } from "@/lib/logging/report";

/**
 * The last net. Replaces the root layout when the root layout itself is what
 * threw, which is the one case `app/error.tsx` cannot cover because it renders
 * inside that layout.
 *
 * Everything here is deliberately self-contained. This file replaces the
 * document, so it has to supply its own `<html>` and `<body>`, and it does NOT
 * receive `app/globals.css` or the Manrope font the root layout loads - which
 * is why the styles below are inline and the font stack is a system one. A
 * Tailwind class here would render unstyled, and a broken error screen is worse
 * than a plain one.
 */
export default function GlobalError({
  error,
  retry
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    setEventId(captureException(error));
  }, [error]);

  const reference = error.digest ?? eventId;

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px",
          background: "#ffffff",
          color: "#0F172A",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        }}
      >
        {/* Metadata exports are unavailable in a Client Component, so the tab
            title comes from React's own `<title>` support instead. */}
        <title>Something went wrong - Event Core</title>
        <div style={{ width: "100%", maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h1>
          <p
            style={{
              marginTop: "0.75rem",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "#475569"
            }}
          >
            Event Core failed to start this page. The problem has been reported.
            You can try again, and if it keeps happening send us the reference
            below.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: "1.5rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#0F172A",
              color: "#ffffff",
              padding: "0.625rem 1.25rem",
              // Named rather than inherited: a button does not inherit the
              // body's font family by default, and the `font` shorthand would
              // reset the size and weight set just above it.
              fontFamily: "inherit",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer"
            }}
          >
            Try again
          </button>
          {reference ? (
            <p
              style={{
                marginTop: "1.5rem",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontSize: "11px",
                wordBreak: "break-all",
                color: "#64748B"
              }}
            >
              Reference: {reference}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
