"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function AppInstallCard() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState(
    "If your browser supports app installation, an install button will appear here."
  );

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      setMessage("Event Core is already installed on this device.");
    }

    function captureInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setMessage("Event Core is ready to install on this device.");
    }

    function markInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
      setMessage("Event Core was installed successfully.");
    }

    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", markInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    setMessage(
      choice.outcome === "accepted"
        ? "Event Core is installing now."
        : "Install was dismissed. You can try again from your browser menu."
    );
  }

  return (
    <section className="rounded-xl border border-[#c8d6e3] bg-[#f8fbff] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1f4d73]">
        Install app
      </p>
      <h2 className="mt-2 text-lg font-black">Install Event Core</h2>
      <p className="mt-2 text-sm leading-6 text-[#59677c]">{message}</p>

      <button
        className="mt-4 h-10 rounded-xl bg-[#1f4d73] px-4 text-sm font-black text-white shadow-sm transition enabled:hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!installPrompt || installed}
        onClick={installApp}
        type="button"
      >
        {installed ? "Installed" : "Install on this device"}
      </button>
    </section>
  );
}
