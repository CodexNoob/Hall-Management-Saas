"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { syncSignedInUser } from "@/lib/auth/client";
import {
  describeAuthCallbackError,
  isExpiredLinkError,
  isPasswordSetupFlow,
  readAuthCallbackParams
} from "@/lib/auth/auth-callback-params";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSafeDashboardReturnPath } from "@/lib/auth/redirect";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState(
    "Confirming your email and preparing your workspace..."
  );
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );

  // Read during render, before the effect below creates the Supabase client and
  // that client strips the `type=invite` / `type=recovery` fragment.
  const callbackParams = readAuthCallbackParams();

  useEffect(() => {
    let isMounted = true;

    async function completeAuth() {
      try {
        // Supabase reports a rejected link in the URL itself and never creates a
        // session for it, so read that first. Falling through to getSession()
        // would replace a precise reason ("link has expired") with a generic
        // missing-session message the recipient cannot act on.
        if (callbackParams.errorDescription) {
          throw new Error(describeAuthCallbackError(callbackParams));
        }

        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session) {
          throw error ?? new Error("No active Supabase session was found.");
        }

        // Invite and recovery links only prove the address; the account still has
        // no password of its own. Hand off before syncing, so the cached profile is
        // never seeded while the password is still missing.
        if (isPasswordSetupFlow(callbackParams.type)) {
          if (isMounted) {
            setStatus("success");
            setMessage("Email verified. Next, choose your password...");
            const nextParam = callbackParams.next
              ? `&next=${encodeURIComponent(callbackParams.next)}`
              : "";
            router.replace(
              `/set-password?flow=${callbackParams.type}${nextParam}` as Parameters<
                typeof router.replace
              >[0]
            );
          }
          return;
        }

        const synced = await syncSignedInUser(data.session.access_token, {
          force: true
        });

        if (isMounted) {
          setStatus("success");

          // A newly confirmed owner has a placeholder organization and no plan
          // yet. The sign-up link already carries next=/dashboard/new, so this
          // covers OAuth sign-ups and links that lost the parameter.
          if (synced.mustCompleteOnboarding) {
            setMessage("Email confirmed. Let's set up your organization...");
            router.replace("/dashboard/new");
            router.refresh();
            return;
          }

          setMessage("Email confirmed. Taking you to your dashboard...");
          router.replace(
            getSafeDashboardReturnPath(
              callbackParams.next
            ) as Parameters<typeof router.replace>[0]
          );
          router.refresh();
        }
      } catch (error) {
        if (isMounted) {
          setStatus("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to complete sign in."
          );
        }
      }
    }

    completeAuth();

    return () => {
      isMounted = false;
    };
    // callbackParams is memoized at module scope, so it is referentially stable.
  }, [router, callbackParams]);

  const isLoading = status === "loading";
  const isSuccess = status === "success";
  // Reloading an expired or already-spent link re-sends the same dead token, so
  // offer the only route that can work: sign in, or get a fresh invitation.
  const isExpired = isExpiredLinkError(callbackParams);

  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-[#F3F6FA] px-5 py-10 text-[#0F172A]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(31,77,115,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(185,151,77,0.16),transparent_34%)]" />
      <section className="relative w-full max-w-[520px] rounded-[32px] border border-white/80 bg-white p-8 text-center shadow-[0_28px_80px_rgba(15,23,42,0.16)] sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#0B1930] shadow-xl shadow-[#0B1930]/20">
          {isLoading ? (
            <Loader2 className="h-8 w-8 animate-spin text-[#D9B45F]" />
          ) : isSuccess ? (
            <CheckCircle2 className="h-8 w-8 text-[#D9B45F]" />
          ) : (
            <AlertCircle className="h-8 w-8 text-[#D9B45F]" />
          )}
        </div>

        <p className="mt-6 text-xs font-black uppercase tracking-[0.28em] text-[#1F4D73]">
          Event Core
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
          {isLoading
            ? "Confirming your email"
            : isSuccess
              ? "Email confirmed"
              : "Confirmation needs attention"}
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
                We verify your email, create your organization access, and then
                send you straight to the dashboard.
              </p>
            </div>
          </div>
        </div>

        {status === "error" ? (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {isExpired ? (
              <Link
                className="inline-flex items-center justify-center rounded-2xl bg-[#1F4D73] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#1F4D73]/20 transition hover:bg-[#163B59]"
                href="/login"
              >
                Go to sign in
              </Link>
            ) : (
              <button
                className="inline-flex items-center justify-center rounded-2xl bg-[#1F4D73] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#1F4D73]/20 transition hover:bg-[#163B59]"
                onClick={() => window.location.reload()}
                type="button"
              >
                Try again
              </button>
            )}
            <Link
              className="inline-flex items-center justify-center rounded-2xl border border-[#B8C4D4] bg-white px-6 py-3 text-sm font-black text-[#0F172A] transition hover:bg-[#F8FAFC]"
              href="/"
            >
              Back to Home
            </Link>
          </div>
        ) : (
          <p className="mt-7 text-sm font-semibold text-[#64748B]">
            Please keep this page open for a moment.
          </p>
        )}
      </section>
    </main>
  );
}
