import Link from "next/link";
import type { PublicPageContent } from "@/features/landing/public-pages/types";

export function CompanyPageSections({ content }: { content: PublicPageContent }) {
  const isLegal = content.title === "Privacy Policy" || content.title === "Terms of Service";
  return isLegal ? <LegalDocument content={content} /> : <CompanyEditorial content={content} />;
}

function CompanyEditorial({ content }: { content: PublicPageContent }) {
  return (
    <section className="bg-[#f7f4ed] px-5 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-3">
          {content.sections.map((section, index) => (
            <article className="relative overflow-hidden rounded-3xl border border-[#e5e0d6] bg-white p-7 shadow-sm sm:p-8" key={section.title}>
              <span className="text-5xl font-black text-[#e7e3da]">{String(index + 1).padStart(2, "0")}</span>
              <div className="mt-8 h-1 w-12 rounded-full bg-[#d7b768]" />
              <h2 className="mt-5 text-2xl font-black tracking-tight text-[#0f172a]">{section.title}</h2>
              <p className="mt-4 text-base leading-8 text-[#526274]">{section.body}</p>
            </article>
          ))}
        </div>
        <div className="mt-12 flex flex-col justify-between gap-6 rounded-3xl bg-white px-7 py-8 shadow-sm sm:flex-row sm:items-center sm:px-10">
          <div><p className="text-sm font-black uppercase tracking-[0.18em] text-[#1f4d73]">Continue the conversation</p><p className="mt-2 text-lg font-bold text-[#0f172a]">Learn how Event Core can support your venue team.</p></div>
          <Link className="inline-flex justify-center rounded-xl bg-[#1f4d73] px-6 py-3 text-sm font-black text-white! shadow-sm hover:bg-[#15344f]" href="/#contact">Contact Event Core</Link>
        </div>
      </div>
    </section>
  );
}

function LegalDocument({ content }: { content: PublicPageContent }) {
  return (
    <section className="bg-[#eef1f5] px-5 py-12 sm:px-8 sm:py-20">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-2xl border border-[#d8dde5] bg-white p-5 lg:sticky lg:top-28">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#64748b]">On this page</p>
          <nav className="mt-4 grid gap-1" aria-label={`${content.title} sections`}>
            {content.sections.map((section, index) => <a className="rounded-lg px-3 py-2 text-sm font-bold text-[#304669] transition hover:bg-[#eef4fa] hover:text-[#1f4d73]" href={`#legal-section-${index + 1}`} key={section.title}>{index + 1}. {section.title}</a>)}
          </nav>
          <p className="mt-6 border-t border-[#e5e0d6] pt-4 text-xs leading-5 text-[#64748b]">Available publicly and from the Event Core dashboard.</p>
        </aside>
        <article className="rounded-3xl border border-[#d8dde5] bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-12">
          <div className="border-b border-[#e5e0d6] pb-8">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#1f4d73]">Event Core</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-[#0f172a] sm:text-4xl">{content.title}</h2>
            <p className="mt-4 max-w-3xl text-base leading-8 text-[#526274]">{content.description}</p>
          </div>
          <div className="divide-y divide-[#e5e0d6]">
            {content.sections.map((section, index) => (
              <section className="scroll-mt-28 py-8" id={`legal-section-${index + 1}`} key={section.title}>
                <div className="grid gap-4 sm:grid-cols-[3rem_minmax(0,1fr)]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#061126] text-sm font-black text-white">{index + 1}</span>
                  <div><h3 className="text-xl font-black text-[#0f172a]">{section.title}</h3><p className="mt-3 text-base leading-8 text-[#526274]">{section.body}</p></div>
                </div>
              </section>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
