import { Suspense } from "react";
import { LoginCard } from "@/features/auth/components/login-card";

export default function LoginPage() {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-white text-[#0F172A]">
      <Suspense fallback={null}>
        <LoginCard />
      </Suspense>
    </main>
  );
}
