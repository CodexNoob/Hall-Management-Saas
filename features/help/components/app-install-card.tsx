const desktopInstallerUrl = process.env.NEXT_PUBLIC_DESKTOP_INSTALLER_URL;

export function AppInstallCard() {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#c8d6e3] bg-linear-to-br from-[#f8fbff] via-white to-[#eef4fa] shadow-sm">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1f4d73]">
            Windows desktop app
          </p>
          <h2 className="mt-2 text-lg font-black text-[#0f172a]">
            Download Event Core
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#59677c]">
            Install the Event Core desktop app on Windows. The app opens
            directly to login, then routes staff to the dashboard based on their
            organization permissions.
          </p>
        </div>

        {desktopInstallerUrl ? (
          <a
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#1f4d73] px-5 text-sm font-black text-white shadow-lg shadow-[#1f4d73]/18 transition hover:bg-[#15344f]"
            href={desktopInstallerUrl}
            rel="noreferrer"
            target="_blank"
          >
            Download Windows app
          </a>
        ) : (
          <button
            className="h-11 shrink-0 rounded-xl bg-[#1f4d73] px-5 text-sm font-black text-white shadow-sm opacity-50"
            disabled
            type="button"
          >
            Download link not ready
          </button>
        )}
      </div>

      <div className="grid border-t border-[#d8dde5] bg-white/70 px-4 py-3 text-xs font-bold text-[#6a7483] sm:grid-cols-3 sm:px-5">
        <span>Secure login required</span>
        <span>Auto-update ready</span>
        <span>Windows installer</span>
      </div>
    </section>
  );
}
