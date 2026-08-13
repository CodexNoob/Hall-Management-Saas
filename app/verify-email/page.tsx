import { Suspense } from "react";
import { VerifyEmailCard } from "@/features/auth/components/verify-email-card";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailCard />
    </Suspense>
  );
}
