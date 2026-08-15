import { Suspense } from "react";
import { SignUpCard } from "@/features/auth/components/signup-card";

export default function SignUpPage() {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-white text-[#0F172A]">
      <Suspense fallback={null}>
        <SignUpCard />
      </Suspense>
    </main>
  );
}
