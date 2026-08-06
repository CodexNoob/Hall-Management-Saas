"use client";

import Link from "next/link";

export function PublicPageActions({ centered = false }: { centered?: boolean }) {
  function openFreeTrial() {
    window.__eventCoreAuthRequest = "trial";
    window.dispatchEvent(
      new CustomEvent("event-core:open-auth", { detail: "trial" })
    );
  }

  return (
    <div className={`mt-3 flex flex-wrap gap-3 ${centered ? "justify-center" : ""}`}>
      <button
        className="rounded-xl bg-[#1f4d73] px-5 py-3 text-sm font-black text-white! shadow-sm transition hover:bg-[#15344f]"
        onClick={openFreeTrial}
        type="button"
      >
        Start free trial
      </button>
      <Link
        className="rounded-xl border border-[#b9c2cf] bg-white px-5 py-3 text-sm font-black text-[#0f172a]! shadow-sm transition hover:bg-[#eef4fa]"
        href="/documentation"
      >
        Read documentation
      </Link>
    </div>
  );
}
