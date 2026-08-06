import { PublicPageActions } from "@/features/landing/components/public-page-actions";
import { productHeroThemeByTitle } from "@/features/landing/public-pages/product-page-assets";
import type { PublicPageContent } from "@/features/landing/public-pages/types";

export function PublicPageHero({ content }: { content: PublicPageContent }) {
  return content.eyebrow === "Product"
    ? <ProductPageHero content={content} />
    : <CompanyPageHero content={content} />;
}

function ProductPageHero({ content }: { content: PublicPageContent }) {
  const theme = productHeroThemeByTitle[content.title];

  return (
    <section className={`relative overflow-hidden border-b border-[#e5e0d6] bg-linear-to-br ${theme}`}>
      <div className="absolute -left-32 top-16 h-80 w-80 rounded-full bg-[#1f4d73]/12 blur-3xl" />
      <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-[#0f172a]/8 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24 lg:py-28">
        <div className="product-hero-3d mx-auto max-w-6xl text-center">
          <nav aria-label="Breadcrumb" className="flex items-center justify-center gap-2 text-base font-bold text-[#64748b] sm:text-lg">
            <span>Event Core</span><span aria-hidden="true" className="text-[#9aa5b4]">/</span><span className="text-[#1f4d73]">{content.title}</span>
          </nav>
          <p className="mt-8 text-sm font-black uppercase tracking-[0.2em] text-[#1f4d73] sm:text-base">Venue operations platform</p>
          <h1 className="mt-4 text-4xl font-black leading-[1.08] tracking-[-0.035em] text-[#0f172a] sm:text-5xl lg:text-6xl">{content.headline ?? content.title}</h1>
          <p className="mx-auto mt-6 max-w-4xl text-lg leading-8 text-[#526274] sm:text-xl">{content.description}</p>
          <div className="mt-8"><PublicPageActions centered /><p className="mt-3 text-xs font-semibold text-[#64748b]">14-day free trial · No credit card required</p></div>
        </div>
      </div>
    </section>
  );
}

function CompanyPageHero({ content }: { content: PublicPageContent }) {
  const isLegal = content.title === "Privacy Policy" || content.title === "Terms of Service";

  return (
    <section className="relative overflow-hidden bg-[#061126] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(31,77,115,0.55),transparent_34%),radial-gradient(circle_at_85%_70%,rgba(196,151,66,0.18),transparent_28%)]" />
      <div className="absolute inset-y-0 right-[12%] hidden w-px bg-white/10 lg:block" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end lg:py-28">
        <div className="max-w-4xl">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-[#d7b768]">{isLegal ? "Event Core Legal" : "Inside Event Core"}</p>
          <h1 className="mt-5 text-4xl font-black tracking-[-0.035em] sm:text-6xl">{content.title}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#c8d2df] sm:text-xl">{content.description}</p>
        </div>
        <div className="border-l border-white/15 pl-6 text-sm leading-7 text-[#aeb8c7]">
          <p className="font-black uppercase tracking-[0.16em] text-white">{isLegal ? "Policy overview" : "Company"}</p>
          <p className="mt-3">{isLegal ? "Public guidance aligned with the policy available inside the Event Core dashboard." : "The people, principles, and operating perspective behind the platform."}</p>
        </div>
      </div>
    </section>
  );
}
