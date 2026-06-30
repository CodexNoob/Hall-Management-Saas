import Image from "next/image";

const stats = [
  {
    value: "500+",
    label: "Venues Managed",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 20h16M6 20V9l6-4 6 4v11M9 20v-6h6v6M8 11h2M14 11h2" />
      </svg>
    )
  },
  {
    value: "99.9%",
    label: "Uptime",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
        <path d="m8.5 12.3 2.2 2.2 4.8-5" />
      </svg>
    )
  },
  {
    value: "24/7",
    label: "Support",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 13v-1a7 7 0 0 1 14 0v1M5 13h3v6H5zM16 13h3v6h-3zM12 21h3" />
      </svg>
    )
  }
];

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
    <section id="home" className="relative min-h-screen overflow-hidden bg-[#F7F4ED] text-[#0F172A]">
      <div className="absolute -left-28 top-24 h-72 w-72 rounded-full bg-[#B9974D]/18 blur-3xl" />
      <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[#0F172A]/10 blur-3xl" />
      <div className="absolute bottom-12 left-1/3 h-44 w-44 rounded-full bg-[#E7E3DA] blur-3xl" />

      <div
        className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 sm:px-8 lg:min-h-[calc(100vh-80px)] lg:grid-cols-[0.9fr_1.1fr] lg:py-20"
      >
        <div>
          <div className="saas-animate-up mb-6 inline-flex rounded-full border border-[#E5E0D6] bg-white/75 px-4 py-2 text-xl font-black uppercase tracking-[0.2em] text-[#B9974D] shadow-sm">
            Hall Management SaaS
          </div>

          <h1 className="saas-animate-up saas-delay-100 max-w-2xl text-4xl font-black leading-[1.08] tracking-tight text-[#0F172A] sm:text-5xl xl:text-6xl">
            Manage Your Hall Bookings, Events, and Operations in{" "}
            <span className="bg-linear-to-r from-[#B9974D] to-[#9C7D37] bg-clip-text text-transparent">One Platform</span>
          </h1>

          <p className="saas-animate-up saas-delay-180 mt-6 max-w-xl text-lg leading-8 text-[#64748B]">
            Streamline bookings, schedules, payments, staff coordination, and customer communication all in one powerful,
            easy-to-use platform.
          </p>

          <div className="saas-animate-up saas-delay-260 mt-9 flex flex-col gap-4 sm:flex-row">
            <a className="saas-hover-lift inline-flex h-13 items-center justify-center rounded-xl bg-[#B9974D] px-7 text-sm font-black text-white! shadow-xl shadow-[#0F172A]/15 hover:bg-[#9C7D37]" href="#trial">
              Start Free Trial
            </a>
            <a className="saas-hover-lift inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-[#E5E0D6] bg-white px-7 text-sm font-black text-[#0F172A] shadow-sm" href="#demo">
              <PlayIcon />
              Watch Demo
            </a>
          </div>

          <div className="mt-12 grid max-w-2xl gap-4 sm:grid-cols-3">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={`saas-animate-up saas-hover-lift rounded-2xl border border-[#E5E0D6] bg-white/85 p-4 shadow-xl shadow-[#B9974D]/5 backdrop-blur ${
                  index === 0 ? "saas-delay-340" : index === 1 ? "saas-delay-420" : "saas-delay-520"
                }`}
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#F7F4ED] text-[#B9974D]">
                  <span className="[&_svg]:h-6 [&_svg]:w-6 [&_svg]:stroke-current [&_svg]:stroke-2">{stat.icon}</span>
                </div>
                <p className="text-xl font-black text-[#0F172A]">{stat.value}</p>
                <p className="mt-1 text-xs font-semibold text-[#64748B]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="saas-animate-glow absolute -inset-6 rounded-4xl bg-linear-to-br from-[#B9974D]/18 via-[#0F172A]/10 to-[#E7E3DA]/70 blur-2xl" />
          <div className="saas-animate-dashboard relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/80 p-2 shadow-2xl shadow-[#0F172A]/18 backdrop-blur-xl">
            <div className="flex h-9 items-center gap-2 rounded-t-[1.35rem] border-b border-[#E5E0D6] bg-[#F7F4ED] px-4">
              <span className="h-3 w-3 rounded-full bg-[#ff6b6b]" />
              <span className="h-3 w-3 rounded-full bg-[#ffbf4d]" />
              <span className="h-3 w-3 rounded-full bg-[#32d583]" />
              <span className="ml-3 h-3 w-28 rounded-full bg-[#E5E0D6]" />
            </div>
            <Image
              src="/HMS.png"
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
