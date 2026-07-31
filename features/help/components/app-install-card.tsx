import Image from "next/image";
import {
  BookOpen,
  CalendarDays,
  Check,
  Cpu,
  Download,
  FileText,
  Headphones,
  Power,
  ShieldCheck
} from "lucide-react";

const desktopInstallerUrl = process.env.NEXT_PUBLIC_DESKTOP_INSTALLER_URL;

const appDetails = [
  { icon: Power, label: "Version", value: "2.1.0" },
  { icon: CalendarDays, label: "Released", value: "Jul 25, 2026" },
  { icon: Download, label: "Size", value: "145 MB" },
  { icon: Cpu, label: "Architecture", value: "64-bit" }
];

const requirements = [
  ["OS", "Windows 10 or later (64-bit)"],
  ["Processor", "1.8 GHz or faster"],
  ["Memory", "4 GB RAM or higher"],
  ["Storage", "200 MB available space"],
  ["Internet", "Required for activation and updates"]
];

const installSteps = [
  ["1. Download", "Download the installer for Windows."],
  ["2. Install", "Run the installer and follow the instructions."],
  ["3. Login", "Open Event Core and sign in with your organization account."],
  ["4. Open Dashboard", "Manage bookings, events, billing, kitchen, dining, files, and staff."]
];

const updates = [
  "Smoother desktop startup loading screen",
  "Dashboard-only desktop login flow",
  "Responsive dashboard module layouts",
  "Hall map, billing, kitchen, and dining fixes"
];

function WindowsMark() {
  return (
    <span className="grid h-5 w-5 grid-cols-2 gap-0.5" aria-hidden="true">
      <span className="bg-current" />
      <span className="bg-current" />
      <span className="bg-current" />
      <span className="bg-current" />
    </span>
  );
}

function DownloadButton() {
  if (!desktopInstallerUrl) {
    return (
      <button
        className="flex h-10 w-full items-center justify-center gap-2.5 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white opacity-50 shadow-lg shadow-[#1f4d73]/20"
        disabled
        type="button"
      >
        <WindowsMark />
        Download link not ready
        <Download className="ml-auto h-4 w-4" />
      </button>
    );
  }

  return (
    <a
      className="flex h-10 w-full items-center justify-center gap-2.5 rounded-lg bg-linear-to-r from-[#1f4d73] to-[#1246c8] px-4 text-xs font-black text-white shadow-xl shadow-[#1f4d73]/25 transition hover:brightness-110"
      href={desktopInstallerUrl}
      rel="noreferrer"
      target="_blank"
    >
      <WindowsMark />
      Download for Windows
      <Download className="ml-auto h-4 w-4" />
    </a>
  );
}

function LaptopPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xs">
      <div className="pointer-events-none absolute inset-x-8 bottom-2 h-12 rounded-full bg-[#071427]/20 blur-2xl" />
      <Image
        alt="Event Core desktop app preview on laptop"
        className="relative h-auto w-full object-contain drop-shadow-xl"
        height={560}
        priority
        src="/images/features/laptop.png"
        width={720}
      />
    </div>
  );
}

export function AppInstallCard() {
  return (
    <section className="grid gap-3">
      <article className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,0.84fr)_minmax(250px,1fr)] lg:items-center">
          <LaptopPreview />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1259ff]">
                Windows desktop app
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-600 text-white">
                    <Check className="h-3 w-3" />
                  </span>
                Latest Version
              </span>
            </div>

            <h2 className="mt-1.5 text-lg font-black tracking-tight text-[#071427] sm:text-xl">
              EventCore Desktop
            </h2>
            <p className="mt-1.5 max-w-xl text-xs leading-5 text-[#59677c]">
              Install the EventCore desktop app on Windows. The app opens
              directly to the employee login, then routes staff into the
              dashboard modules allowed by their organization permissions.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {appDetails.map((detail) => (
                <div className="flex min-w-0 items-center gap-2" key={detail.label}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#d8dde5] bg-[#f8fbff] text-[#1259ff]">
                    <detail.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] text-[#617086]">{detail.label}</span>
                    <span className="block truncate text-[11px] font-black text-[#071427]">{detail.value}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <DownloadButton />
              <p className="mt-2 text-[11px] font-bold text-[#617086]">Windows 10 or later</p>
            </div>
          </div>
        </div>

        <div className="grid gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] p-3 sm:grid-cols-3">
          {[
            ["Secure & Verified", "Digitally signed installer"],
            ["Dashboard Ready", "Opens directly to Event Core"],
            ["Organization Access", "Uses your dashboard permissions"]
          ].map(([title, body]) => (
            <div className="flex items-center gap-2.5" key={title}>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-xs font-black text-[#071427]">{title}</span>
                <span className="block text-[11px] text-[#617086]">{body}</span>
              </span>
            </div>
          ))}
        </div>
      </article>

      <div className="grid gap-3 lg:grid-cols-3">
        <article className="rounded-xl border border-[#d8dde5] bg-white p-3 shadow-sm">
          <h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1259ff]">
            System Requirements
          </h3>
          <div className="mt-3 grid gap-2.5">
            {requirements.map(([label, value]) => (
              <div className="grid grid-cols-[72px_1fr] gap-2 text-xs" key={label}>
                <span className="font-black text-[#071427]">{label}</span>
                <span className="text-[#59677c]">{value}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-[#d8dde5] bg-white p-3 shadow-sm">
          <h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1259ff]">
            Installation Steps
          </h3>
          <div className="mt-3 grid gap-2.5">
            {installSteps.map(([title, body], index) => (
              <div className="grid grid-cols-[28px_1fr] gap-2.5" key={title}>
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#1259ff] text-[11px] font-black text-white">
                  {index + 1}
                </span>
                <span>
                  <span className="block text-xs font-black text-[#071427]">{title}</span>
                  <span className="mt-1 block text-xs leading-5 text-[#59677c]">{body}</span>
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-[#d8dde5] bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1259ff]">
              What&apos;s New
            </h3>
            <span className="rounded-lg bg-[#eef4ff] px-2 py-1 text-xs font-black text-[#1259ff]">
              v2.1.0
            </span>
          </div>
          <div className="mt-3 grid gap-2.5">
            {updates.map((item) => (
              <div className="flex items-center gap-2.5 text-xs text-[#59677c]" key={item}>
                <Check className="h-4 w-4 text-emerald-600" />
                {item}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs font-black text-[#1259ff]">
            Release notes are available from the Help menu.
          </p>
        </article>
      </div>

      <article className="flex flex-col gap-3 rounded-xl border border-[#d8dde5] bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#eef4ff] text-[#1259ff]">
            <Headphones className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-black text-[#071427]">Need help installing?</h3>
            <p className="mt-1 text-xs leading-5 text-[#59677c]">
              Follow our installation guide or contact your administrator for assistance.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <a
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#d8dde5] bg-white px-4 text-xs font-black text-[#1f4d73] transition hover:bg-[#eef4fa]"
            href="#"
          >
            <FileText className="mr-2 h-4 w-4" />
            Installation Guide
          </a>
          <a
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#d8dde5] bg-white px-4 text-xs font-black text-[#1f4d73] transition hover:bg-[#eef4fa]"
            href="#"
          >
            <BookOpen className="mr-2 h-4 w-4" />
            View Documentation
          </a>
        </div>
      </article>
    </section>
  );
}
