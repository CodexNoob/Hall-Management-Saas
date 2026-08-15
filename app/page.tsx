import { BenefitsSection } from "@/features/landing/components/benefits-section";
import { ContactModal } from "@/features/landing/components/contact-modal";
import { FeaturesSection } from "@/features/landing/components/features-section";
import { HallFlowHero } from "@/features/landing/components/hero";
import { LandingFooter } from "@/features/landing/components/landing-footer";
import { LandingLoadingScreen } from "@/features/landing/components/landing-loading-screen";
import { LandingNavbar } from "@/features/landing/components/landing-navbar";
import { PricingSection } from "@/features/landing/components/pricing-section";
import { Manrope } from "next/font/google";

const manrope = Manrope({
  subsets: ['latin'],
  display: "swap"
});

export default function Home() {
  return (
    <main className={`${manrope.className} min-h-screen bg-white pt-20`}>
      <LandingLoadingScreen />
      <LandingNavbar />
      <HallFlowHero />
      <FeaturesSection />
      <BenefitsSection />
      <PricingSection />
      <LandingFooter />
      <ContactModal />
    </main>
  );
}
