import Image from "next/image";
import { PublicPageActions } from "@/features/landing/components/public-page-actions";
import { workflowImageByTitle } from "@/features/landing/public-pages/product-page-assets";
import type { PublicPageContent, PublicPageSection } from "@/features/landing/public-pages/types";

export function PublicPageSections({ content }: { content: PublicPageContent }) {
  return (
    <section className="relative bg-white px-5 py-16 sm:px-8 sm:py-24" id="workflow">
      <div className="mx-auto max-w-7xl">
        <SectionHeading />
        <div className="mt-12 grid gap-4">
          {content.sections.map((section, index) => (
            <WorkflowSection index={index} key={section.title} section={section} />
          ))}
        </div>
        <BottomCallToAction />
      </div>
    </section>
  );
}

function SectionHeading() {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-[#1f4d73]">Explore the workflow</p>
      <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Professional tools, with the operational detail your team needs</h2>
      <p className="mt-4 text-base leading-7 text-[#64748b]">Open each section to see how the feature works across the Event Core dashboard.</p>
    </div>
  );
}

function WorkflowSection({ index, section }: { index: number; section: PublicPageSection }) {
  const image = workflowImageByTitle[section.title];

  return (
    <details
      className="product-workflow-3d group overflow-hidden rounded-2xl border border-[#e5e0d6] bg-white/95 shadow-sm backdrop-blur-sm open:border-[#1f4d73]/45"
      open={index === 0}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-5 sm:px-7 sm:py-6 [&::-webkit-details-marker]:hidden">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef4fa] text-sm font-black text-[#1f4d73]">{String(index + 1).padStart(2, "0")}</span>
        <span className="min-w-0 flex-1"><strong className="block text-lg font-black sm:text-xl">{section.title}</strong><span className="mt-1 block text-sm leading-6 text-[#64748b]">{section.body}</span></span>
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d8dde5] text-xl font-light text-[#1f4d73] transition group-open:rotate-45">+</span>
      </summary>
      <div className="border-t border-[#e5e0d6] bg-[#fbfcfd] px-5 py-6 sm:px-7">
        <div className={`grid items-center gap-7 ${image ? "lg:grid-cols-[minmax(0,1fr)_280px]" : ""}`}>
          <SectionDetails section={section} />
          {image ? <WorkflowImage image={image} title={section.title} /> : null}
        </div>
      </div>
    </details>
  );
}

function SectionDetails({ section }: { section: PublicPageSection }) {
  return (
    <div>
      {section.details ? <p className="max-w-4xl text-base leading-8 text-[#526274]">{section.details}</p> : null}
      {section.items ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {section.items.map((item) => <li className="flex items-center gap-2 rounded-xl border border-[#dce3ec] bg-white px-4 py-3 text-sm font-bold text-[#173b58]" key={item}><span className="h-2 w-2 shrink-0 rounded-full bg-[#1f4d73]" />{item}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

function WorkflowImage({ image, title }: { image: string; title: string }) {
  return (
    <figure className="flex min-h-56 items-center justify-center rounded-2xl border border-[#e5e0d6] bg-white p-6 shadow-sm">
      <Image alt={`${title} workflow illustration`} className="h-44 w-44 object-contain" height={352} src={image} width={352} />
    </figure>
  );
}

function BottomCallToAction() {
  return (
    <div className="mt-12 rounded-3xl bg-[#061126] px-6 py-10 text-center text-white sm:px-10">
      <h2 className="text-2xl font-black sm:text-3xl">Ready to bring your venue operations together?</h2>
      <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-[#aeb8d1]">Start with your organization, configure halls and event types, and build a workflow that matches the way your team operates.</p>
      <div className="flex justify-center"><PublicPageActions /></div>
    </div>
  );
}
