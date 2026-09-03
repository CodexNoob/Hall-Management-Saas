import { Suspense } from "react";
import { ForgotPasswordCard } from "@/features/auth/components/forgot-password-card";
import { ContactModal } from "@/features/landing/components/contact-modal";

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-white text-[#0F172A]">
      <Suspense fallback={null}>
        <ForgotPasswordCard />
      </Suspense>
      <ContactModal />
    </main>
  );
}
