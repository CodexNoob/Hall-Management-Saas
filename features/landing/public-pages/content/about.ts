import type { PublicPageContent } from "@/features/landing/public-pages/types";

export const aboutPage: PublicPageContent = {
  eyebrow: "Company",
  title: "About Event Core",
  description: "Event Core is building practical operating software for halls, venues, caterers, and event teams.",
  sections: [
    { title: "Our mission", body: "We help venue teams replace fragmented spreadsheets, messages, and disconnected tools with one clear operational system." },
    { title: "Built around real operations", body: "Our product connects bookings, events, halls, calendars, kitchen work, dining plans, billing, files, vendors, and staff access." },
    { title: "Our approach", body: "We prioritize reliable workflows, understandable interfaces, organization data isolation, and tools that work across desktop and mobile." }
  ]
};
