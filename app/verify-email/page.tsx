import { Suspense } from "react";
import { VerifyEmailCard } from "@/features/auth/components/verify-email-card";

export default function VerifyEmailPage() {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-white text-[#0F172A]">
      <Suspense fallback={null}>
        <VerifyEmailCard />
      </Suspense>
    </main>
  );
}
