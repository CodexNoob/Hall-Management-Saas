import { SignupCard } from "@/components/signup/signup-card";

export default function SignupPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-linear-to-br from-white via-[#f8f7ff] to-[#edf4ff] px-4 py-8 text-[#0b1433] sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -left-24 top-16 h-80 w-80 rounded-full bg-[#dce8ff] blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-14 h-96 w-96 rounded-full bg-[#e7d9ff] blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-48 w-2xl -translate-x-1/2 rounded-full bg-white/70 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-64px)] max-w-7xl items-center justify-center">
        <SignupCard />
      </div>
    </main>
  );
}
