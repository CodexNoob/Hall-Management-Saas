const desktopInstallerUrl = process.env.NEXT_PUBLIC_DESKTOP_INSTALLER_URL;

export function AppInstallCard() {
  return (
    <section className="rounded-xl border border-[#c8d6e3] bg-[#f8fbff] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1f4d73]">
        Windows desktop app
      </p>
      <h2 className="mt-2 text-lg font-black">Download Event Core</h2>
      <p className="mt-2 text-sm leading-6 text-[#59677c]">
        Install the Event Core desktop app on Windows. After installation, the
        app opens the dashboard and asks the user to log in before showing any
        organization data.
      </p>

      {desktopInstallerUrl ? (
        <a
          className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[#1f4d73] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#15344f]"
          href={desktopInstallerUrl}
          rel="noreferrer"
          target="_blank"
        >
          Download Windows app
        </a>
      ) : (
        <button
          className="mt-4 h-10 rounded-xl bg-[#1f4d73] px-4 text-sm font-black text-white shadow-sm opacity-50"
          disabled
          type="button"
        >
          Download link not ready
        </button>
      )}

      <p className="mt-3 text-xs leading-5 text-[#6a7483]">
        The installer download URL is controlled by
        NEXT_PUBLIC_DESKTOP_INSTALLER_URL.
      </p>
    </section>
  );
}
