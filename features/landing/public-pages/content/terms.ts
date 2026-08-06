import { termsOfServiceIntroduction, termsOfServiceSections } from "@/features/legal/legal-content";
import type { PublicPageContent } from "@/features/landing/public-pages/types";

export const termsPage: PublicPageContent = {
  eyebrow: "Company",
  title: "Terms of Service",
  description: termsOfServiceIntroduction,
  sections: [...termsOfServiceSections]
};
