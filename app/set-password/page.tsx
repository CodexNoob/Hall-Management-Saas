import { Suspense } from "react";
import { SetPasswordCard } from "@/features/auth/components/set-password-card";
import { ContactModal } from "@/features/landing/components/contact-modal";

export default function SetPasswordPage() {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-white text-[#0F172A]">
      <Suspense fallback={null}>
        <SetPasswordCard />
      </Suspense>
      <ContactModal />
    </main>
  );
}
