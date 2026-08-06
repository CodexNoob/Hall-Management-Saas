import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthModal } from "@/features/auth/components/auth-modal";
import { ContactModal } from "@/features/landing/components/contact-modal";
import { LandingFooter } from "@/features/landing/components/landing-footer";
import { LandingNavbar } from "@/features/landing/components/landing-navbar";
import { PublicContentPage } from "@/features/landing/components/public-content-page";
import { companyPages } from "@/features/landing/public-pages/company-pages";

type CompanyPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return Object.keys(companyPages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: CompanyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = companyPages[slug];
  return page ? { title: `${page.title} | Event Core`, description: page.description } : {};
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  const { slug } = await params;
  const content = companyPages[slug];
  if (!content) notFound();

  return (
    <>
      <LandingNavbar />
      <PublicContentPage content={content} />
      <LandingFooter />
      <ContactModal />
      <AuthModal />
    </>
  );
}
