"use client";

import {
  type IconName,
  LineIcon
} from "@/features/billing/components/billing-shared";

export async function ensurePlaidScript() {
  if (typeof window === "undefined") return false;
  if ((window as typeof window & { Plaid?: unknown }).Plaid) return true;

  const existing = document.querySelector("script[data-plaid-link]");
  if (existing) {
    return new Promise<boolean>((resolve) => {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
    });
  }

  return new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    script.async = true;
    script.setAttribute("data-plaid-link", "true");
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function PlaidConnectionPanel({
  connected,
  onConnect,
  onDisconnect,
  onManage,
  onSync
}: {
  connected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onManage: () => void;
  onSync: () => void;
}) {
  return (
    <section className="border-b border-[#d8dde5] bg-[#f8fbff] px-4 py-3">
      <div className="flex flex-col gap-3 rounded-xl border border-[#d8dde5] bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between md:p-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef4fa] text-[#1f4d73]">
            <LineIcon className="h-5 w-5" name="bank" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6a7483]">
              Plaid bank feed
            </p>
            <h3 className="text-base font-black text-[#17202a]">
              {connected
                ? "Business checking connected"
                : "Connect a bank account"}
            </h3>
            <p className="mt-1 text-sm text-[#526274]">
              {connected
                ? "Event Core demo bank •••• 1909 is ready to import and review transactions."
                : "Use Plaid to securely import bank transactions into this billing workspace."}
            </p>
          </div>
        </div>

        {connected ? (
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <span className="rounded-full border border-[#9fd9b6] bg-[#e2f7eb] px-3 py-1 text-xs font-black text-[#12863d]">
              Connected
            </span>
            <button
              className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-black text-[#17202a] transition hover:bg-[#eef4fa]"
              onClick={onSync}
              type="button"
            >
              Sync now
            </button>
            <button
              className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-black text-[#17202a] transition hover:bg-[#eef4fa]"
              onClick={onManage}
              type="button"
            >
              Manage
            </button>
            <button
              className="h-9 rounded-lg border border-[#e3b4ad] bg-white px-3 text-sm font-black text-[#b22920] transition hover:bg-[#fff0ee]"
              onClick={onDisconnect}
              type="button"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#1f4d73] bg-[#1f4d73] px-4 text-sm font-black text-white shadow-md shadow-[#1f4d73]/15 transition hover:bg-[#173a57]"
            onClick={onConnect}
            type="button"
          >
            <LineIcon className="h-4 w-4" name="plus" />
            Connect bank
          </button>
        )}
      </div>
    </section>
  );
}

export function PlaidConnectDialog({
  connected,
  onClose,
  onConnect,
  open,
  busy
}: {
  connected: boolean;
  onClose: () => void;
  onConnect: () => void;
  open: boolean;
  busy: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#061126]/55 p-4 backdrop-blur-sm">
      <section className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[#d8dde5] px-5 py-4">
          <div className="flex gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#061126] text-white">
              <LineIcon className="h-6 w-6" name="bank" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1f4d73]">
                Plaid connection
              </p>
              <h2 className="text-xl font-black text-[#17202a]">
                Connect bank account
              </h2>
              <p className="mt-1 text-sm text-[#526274]">
                Link a business bank account so Event Core can import, review,
                match, and post transactions.
              </p>
            </div>
          </div>
          <button
            aria-label="Close Plaid connection"
            className="group flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-[#233144] shadow-none transition hover:bg-[#e4edf5] hover:text-[#1f4d73] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4d73]/25"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true" className="relative h-4 w-4">
              <span className="absolute left-1/2 top-1/2 h-0.5 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-current transition-transform group-hover:scale-110" />
              <span className="absolute left-1/2 top-1/2 h-0.5 w-4 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current transition-transform group-hover:scale-110" />
            </span>
          </button>
        </header>

        <div className="grid gap-4 px-5 py-5 md:grid-cols-3">
          {[
            {
              title: "1. Secure login",
              text: "The user chooses their bank and signs in through Plaid, not inside Event Core.",
              icon: "payment" as IconName
            },
            {
              title: "2. Choose account",
              text: "Select the checking account to sync with the Billing transaction center.",
              icon: "bank" as IconName
            },
            {
              title: "3. Review feed",
              text: "Imported transactions appear here for matching, posting, and reporting.",
              icon: "invoice" as IconName
            }
          ].map((step) => (
            <article
              className="rounded-xl border border-[#d8dde5] bg-[#f8fbff] p-4"
              key={step.title}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#1f4d73] shadow-sm">
                <LineIcon className="h-5 w-5" name={step.icon} />
              </span>
              <h3 className="mt-3 text-sm font-black text-[#17202a]">
                {step.title}
              </h3>
              <p className="mt-1 text-sm leading-6 text-[#526274]">
                {step.text}
              </p>
            </article>
          ))}
        </div>

        <div className="border-t border-[#d8dde5] bg-[#f8fbff] px-5 py-4">
          <div className="rounded-xl border border-[#b9c2cf] bg-white p-4">
            <h3 className="font-black text-[#17202a]">
              What we still need for live Plaid
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-[#526274]">
              <li>
                • Plaid credentials must be configured in the server
                environment.
              </li>
              <li>
                • The connection is stored only for the active organization.
              </li>
              <li>
                • Bank transactions will sync into this billing workspace after
                the account is linked.
              </li>
            </ul>
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="h-11 rounded-lg border border-[#b9c2cf] bg-white px-4 text-sm font-black text-[#17202a] transition hover:bg-[#eef4fa]"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="h-11 rounded-lg border border-[#1f4d73] bg-[#1f4d73] px-5 text-sm font-black text-white shadow-md shadow-[#1f4d73]/15 transition hover:bg-[#173a57] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
              onClick={onConnect}
              type="button"
            >
              {busy
                ? "Connecting…"
                : connected
                  ? "Reconnect bank"
                  : "Continue to Plaid"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
