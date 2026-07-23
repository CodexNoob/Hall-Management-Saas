import { FreeTrialCard } from "@/features/auth/components/free-trial-card";

export default function StartTrialPage() {
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-linear-to-br from-white via-[#F7F4ED] to-[#F1F5F9] px-2 py-4 text-[#0F172A] sm:px-6 sm:py-8 lg:px-8">
      <div className="pointer-events-none absolute -left-24 top-16 h-80 w-80 rounded-full bg-[#F1F5F9] blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-14 h-96 w-96 rounded-full bg-[#E5E0D6] blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-48 w-2xl -translate-x-1/2 rounded-full bg-white/70 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100dvh-2rem)] max-w-7xl items-center justify-center sm:min-h-[calc(100dvh-4rem)]">
        <FreeTrialCard />
      </div>
    </main>
  );
}
