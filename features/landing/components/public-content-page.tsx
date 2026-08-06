import { PublicPageHero } from "@/features/landing/public-pages/public-page-hero";
import { CompanyPageSections } from "@/features/landing/public-pages/company-page-sections";
import { PublicPageSections } from "@/features/landing/public-pages/public-page-sections";
import type { PublicPageContent } from "@/features/landing/public-pages/types";

export function PublicContentPage({ content }: { content: PublicPageContent }) {
  return (
    <main className="min-h-screen overflow-hidden bg-white pt-20 text-[#0f172a]">
      <PublicPageHero content={content} />
      {content.eyebrow === "Product"
        ? <PublicPageSections content={content} />
        : <CompanyPageSections content={content} />}
    </main>
  );
}
