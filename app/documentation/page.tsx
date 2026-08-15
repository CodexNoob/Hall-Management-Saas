import type { Metadata } from "next";
import { ContactModal } from "@/features/landing/components/contact-modal";
import { LandingFooter } from "@/features/landing/components/landing-footer";
import { LandingNavbar } from "@/features/landing/components/landing-navbar";
import { DocumentationPage } from "@/features/documentation/components/documentation-page";

export const metadata: Metadata = {
  title: "Documentation | Event Core",
  description:
    "Step-by-step guides for using Event Core hall management workflows."
};

export default function DocumentationRoute() {
  return (
    <>
      <LandingNavbar />
      <DocumentationPage />
      <LandingFooter />
      <ContactModal />
    </>
  );
}
