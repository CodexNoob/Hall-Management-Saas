import type { PublicPageContent } from "@/features/landing/public-pages/types";

export const calendarPage: PublicPageContent = {
  eyebrow: "Product",
  title: "Calendar",
  headline: "A venue calendar that understands halls, holds, and operating time.",
  description: "Plan events against real hall availability, preserve booking context, and identify scheduling conflicts before they become operational problems.",
  sections: [
    { title: "Hall-aware calendar planning", body: "Review venue activity by date while retaining the hall and booking context behind every entry.", details: "Calendar records include the client, event type, selected hall, timing, and booking status. Authorized users can open the related event or begin a new calendar booking without leaving the schedule.", items: ["Monthly event visibility", "Hall and room context", "Direct booking creation"] },
    { title: "Availability before commitment", body: "Use the same booking rules from the core reservation engine when creating calendar entries.", details: "The system checks existing events and reservations for the organization and hall. Tentative holds, confirmed bookings, setup windows, cleanup windows, and expired holds are evaluated consistently.", items: ["Conflict detection", "Tentative hold awareness", "Setup and cleanup protection"] },
    { title: "Reliable date handling", body: "Avoid the common off-by-one-day errors caused by browser and server timezone differences.", details: "Date-only event values are normalized for calendar display and stored consistently. Organization timezone settings and explicit formatting keep operating dates understandable across desktop and mobile users." },
    { title: "Operational schedule context", body: "Move from a calendar entry to the complete event workflow when more detail is needed.", details: "Calendar events connect to clients, packages, guest totals, payment status, kitchen planning, dining arrangements, files, and event notes, giving staff useful context without overcrowding the calendar itself." },
    { title: "External calendar support", body: "Connect supported calendar providers without replacing Event Core as the operational source of truth.", details: "Google Calendar integration settings support authorized synchronization for organizations that need external visibility while keeping booking permissions and venue-specific details inside Event Core." }
  ]
};
