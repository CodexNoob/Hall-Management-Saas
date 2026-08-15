import Image from "next/image";

function PlayIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="m10 8 6 4-6 4z" fill="currentColor" />
    </svg>
  );
}

export function HallFlowHero() {
  return (
    <section
      id="home"
      className="relative min-h-screen overflow-hidden bg-[#F7F4ED] text-[#0F172A]"
    >
      <div className="absolute -left-28 top-24 h-72 w-72 rounded-full bg-[#1f4d73]/18 blur-3xl" />
      <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[#0F172A]/10 blur-3xl" />
      <div className="absolute bottom-12 left-1/3 h-44 w-44 rounded-full bg-[#E7E3DA] blur-3xl" />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 sm:px-8 lg:min-h-[calc(100vh-80px)] lg:grid-cols-[0.9fr_1.1fr] lg:py-20">
        <div className="text-center lg:text-left">
          <div className="saas-animate-up mb-6 inline-flex rounded-full border border-[#E5E0D6] bg-white/75 px-4 py-2 text-xl font-black uppercase tracking-[0.2em] text-[#1f4d73] shadow-sm">
            EVENT CORE
          </div>

          <h1 className="saas-animate-up saas-delay-100 mx-auto max-w-2xl text-4xl font-black leading-[1.08] tracking-tight text-[#0F172A] sm:text-5xl lg:mx-0 xl:text-6xl">
            Everything You Need to Manage Your Simcha Hall{" "}
            <span className="bg-linear-to-r from-[#1f4d73] to-[#15344f] bg-clip-text text-transparent">
              All in One Platform
            </span>
          </h1>

          <p className="saas-animate-up saas-delay-180 mx-auto mt-6 max-w-xl text-lg leading-8 text-[#64748B] lg:mx-0">
            The only all-in-one management platform built 
            specifically for simcha halls. Manage bookings, 
            payments, events, hall layouts, staff coordination,
            and more from one simple system.
          </p>

          <div className="saas-animate-up saas-delay-260 mt-9 flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start">
            <a
              className="saas-hover-lift inline-flex h-13 items-center justify-center rounded-xl bg-[#1f4d73] px-7 text-sm font-black text-white! shadow-xl shadow-[#0F172A]/15 hover:bg-[#15344f]"
              href="/signup"
            >
              Get Started Free
            </a>
            <a
              className="saas-hover-lift inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-[#E5E0D6] bg-white px-7 text-sm font-black text-[#0F172A] shadow-sm"
              href="#demo"
            >
              <PlayIcon />
              Watch Demo
            </a>
          </div>

          <p className="saas-animate-up saas-delay-260 mt-4 text-xs font-semibold text-[#64748B]">
            14-day free trial &middot; No credit card required
          </p>
        </div>

        <div className="relative">
          <div className="saas-animate-glow absolute -inset-6 rounded-4xl bg-linear-to-br from-[#1f4d73]/18 via-[#0F172A]/10 to-[#E7E3DA]/70 blur-2xl" />
          <div className="saas-animate-dashboard relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/80 p-2 shadow-2xl shadow-[#0F172A]/18 backdrop-blur-xl">
            <div className="flex h-9 items-center gap-2 rounded-t-[1.35rem] border-b border-[#E5E0D6] bg-[#F7F4ED] px-4">
              <span className="h-3 w-3 rounded-full bg-[#ff6b6b]" />
              <span className="h-3 w-3 rounded-full bg-[#ffbf4d]" />
              <span className="h-3 w-3 rounded-full bg-[#32d583]" />
              <span className="ml-3 h-3 w-28 rounded-full bg-[#E5E0D6]" />
            </div>
            <Image
              src="/images/branding/HMS.png"
              alt="HallFlow admin dashboard for bookings, payments, halls, events, staff, and reports"
              width={941}
              height={543}
              priority
              quality={100}
              className="h-auto w-full rounded-b-[1.35rem]"
              sizes="(max-width: 1024px) 100vw, 720px"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
