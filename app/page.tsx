import { AiChatWidget } from "@/components/widgets/ai-chat-widget";
import { BenefitsSection } from "@/components/landing/benefits-section";
import { ContactModal } from "@/components/landing/contact-modal";
import { FeaturesSection } from "@/components/landing/features-section";
import { HallFlowHero } from "@/components/landing/hero";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { LandingFooter } from "@/components/landing/landing-footer";
import { AuthModal } from "@/components/forms-and-modals/auth-modal";
import { PricingSection } from "@/components/landing/pricing-section";

export default function Home() {
  return (
    <main className="min-h-screen bg-white pt-20">
      <LandingNavbar />
      <HallFlowHero />
      <FeaturesSection />
      <BenefitsSection />
      <PricingSection />
      <LandingFooter />
      <ContactModal />
      <AuthModal />
      <AiChatWidget />
    </main>
  );
}
