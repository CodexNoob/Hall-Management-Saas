import { privacyPolicyIntroduction, privacyPolicySections } from "@/features/legal/legal-content";
import type { PublicPageContent } from "@/features/landing/public-pages/types";

export const privacyPage: PublicPageContent = {
  eyebrow: "Company",
  title: "Privacy Policy",
  description: privacyPolicyIntroduction,
  sections: [...privacyPolicySections]
};
