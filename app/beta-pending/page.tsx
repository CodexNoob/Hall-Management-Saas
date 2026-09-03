import { BetaPendingCard } from "@/features/auth/components/beta-pending-card";

/**
 * Reachable with or without a session, and that is deliberate.
 *
 * A refused applicant arrives here after their Supabase session has been ended,
 * but the proxy's anonymous-only list is `/login`, `/signup` and
 * `/forgot-password` only - so if a session does survive, this page still
 * renders rather than bouncing them to a dashboard that will refuse them.
 *
 * No Suspense boundary, unlike /verify-email: the card reads `?status=` from
 * `window.location` after mount rather than through `useSearchParams`, so this
 * page stays static and there is nothing to suspend on.
 */
export default function BetaPendingPage() {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-white text-[#0F172A]">
      <BetaPendingCard />
    </main>
  );
}
