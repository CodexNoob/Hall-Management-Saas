import Link from "next/link";

export function PublicPageActions({ centered = false }: { centered?: boolean }) {
  return (
    <div className={`mt-3 flex flex-wrap gap-3 ${centered ? "justify-center" : ""}`}>
      <Link
        className="rounded-xl bg-[#1f4d73] px-5 py-3 text-sm font-black text-white! shadow-sm transition hover:bg-[#15344f]"
        href="/signup"
      >
        Get Started Free
      </Link>
      <Link
        className="rounded-xl border border-[#b9c2cf] bg-white px-5 py-3 text-sm font-black text-[#0f172a]! shadow-sm transition hover:bg-[#eef4fa]"
        href="/documentation"
      >
        Read documentation
      </Link>
    </div>
  );
}
