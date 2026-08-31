"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ShieldCheck } from "lucide-react";
import {
  describeAuthCallbackError,
  isExpiredLinkError,
  parseAuthCallbackParams,
  type AuthCallbackParams
} from "@/lib/auth/auth-callback-params";

/**
 * `initial` comes from the server, parsed out of the query string, and is what
 * both the server and the first client render use - so the markup matches and
 * hydration is clean.
 *
 * The fragment is the only thing this has to do on the client: `#error=...` is
 * never sent to the server, so a page rendered purely from searchParams would
 * show the generic message for a link Supabase rejected with a precise reason.
 * Reading it after mount upgrades the copy without risking a mismatch, because
 * the first render is identical on both sides.
 */
export function AuthErrorView({ initial }: { initial: AuthCallbackParams }) {
  const [params, setParams] = useState(initial);

  useEffect(() => {
    if (!window.location.hash) return;

    const fromUrl = parseAuthCallbackParams(window.location.href);

    if (fromUrl.errorCode || fromUrl.errorDescription) {
      setParams(fromUrl);
    }
  }, []);

  const message = describeAuthCallbackError(params);
  // Reloading an expired or already-spent link re-sends the same dead token, so
  // offer the only route that can work: sign in, or get a fresh invitation.
  const isExpired = isExpiredLinkError(params);

  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-[#F3F6FA] px-5 py-10 text-[#0F172A]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(31,77,115,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(185,151,77,0.16),transparent_34%)]" />
      <section className="relative w-full max-w-[520px] rounded-[32px] border border-white/80 bg-white p-8 text-center shadow-[0_28px_80px_rgba(15,23,42,0.16)] sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-[#d8dde5]">
          <AlertCircle className="h-8 w-8 text-[#0B1930]" strokeWidth={1.5} />
        </div>

        <p className="mt-6 text-xs font-black uppercase tracking-[0.28em] text-[#1F4D73]">
          Event Core
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
          Confirmation needs attention
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-base font-semibold leading-7 text-[#64748B]">
          {message}
        </p>

        <div className="mt-7 rounded-2xl border border-[#D8DEE8] bg-[#F8FBFF] p-4 text-left">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#1F4D73] shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-[#0F172A]">
                Secure workspace setup
              </p>
              <p className="mt-1 text-sm leading-6 text-[#64748B]">
                Confirmation links can only be opened once, and they stop
                working after a while. A fresh one always works.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {isExpired ? (
            <Link
              className="inline-flex items-center justify-center rounded-2xl bg-[#1F4D73] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#1F4D73]/20 transition hover:bg-[#163B59]"
              href="/login"
            >
              Go to sign in
            </Link>
          ) : (
            <Link
              className="inline-flex items-center justify-center rounded-2xl bg-[#1F4D73] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#1F4D73]/20 transition hover:bg-[#163B59]"
              href="/forgot-password"
            >
              Email me a new link
            </Link>
          )}
          <Link
            className="inline-flex items-center justify-center rounded-2xl border border-[#B8C4D4] bg-white px-6 py-3 text-sm font-black text-[#0F172A] transition hover:bg-[#F8FAFC]"
            href="/"
          >
            Back to Home
          </Link>
        </div>
      </section>
    </main>
  );
}
