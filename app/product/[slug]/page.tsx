import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthModal } from "@/features/auth/components/auth-modal";
import { ContactModal } from "@/features/landing/components/contact-modal";
import { LandingFooter } from "@/features/landing/components/landing-footer";
import { LandingNavbar } from "@/features/landing/components/landing-navbar";
import { PublicContentPage } from "@/features/landing/components/public-content-page";
import { productPages } from "@/features/landing/public-pages/product-pages";

type ProductPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return Object.keys(productPages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = productPages[slug];
  return page ? { title: `${page.title} | Event Core`, description: page.description } : {};
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const content = productPages[slug];
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
