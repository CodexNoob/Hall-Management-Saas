import { aboutPage } from "@/features/landing/public-pages/content/about";
import { careersPage } from "@/features/landing/public-pages/content/careers";
import { privacyPage } from "@/features/landing/public-pages/content/privacy";
import { termsPage } from "@/features/landing/public-pages/content/terms";
import type { PublicPageContent } from "@/features/landing/public-pages/types";

export const companyPages: Record<string, PublicPageContent> = {
  about: aboutPage,
  careers: careersPage,
  privacy: privacyPage,
  terms: termsPage
};
