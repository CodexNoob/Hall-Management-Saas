import { LoginCard } from "@/features/auth/components/login-card";

export default function NewEventPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-linear-to-br from-white via-[#F7F4ED] to-[#F1F5F9] px-4 py-8 text-[#0F172A] sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -left-24 top-16 h-80 w-80 rounded-full bg-[#F1F5F9] blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-14 h-96 w-96 rounded-full bg-[#E5E0D6] blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-48 w-2xl -translate-x-1/2 rounded-full bg-white/70 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-64px)] max-w-7xl items-center justify-center">
        <LoginCard />
      </div>
    </main>
  );
}
