import type { PublicPageContent } from "@/features/landing/public-pages/types";

export const bookingManagementPage: PublicPageContent = {
  eyebrow: "Product",
  title: "Booking Management",
  headline: "Move from first inquiry to event day without losing the details.",
  description: "Manage availability, client information, proposals, holds, confirmations, and department handoffs in one structured booking workflow.",
  sections: [
    { title: "Inquiry-to-confirmation workflow", body: "Capture the client, contact information, requested date, hall, event type, package, and guest count in a consistent booking form.", details: "Create a tentative proposal when details are still being negotiated or save a confirmed booking when the client is ready. Event Core retains the booking status and connects the record to the operating calendar instead of forcing staff to re-enter the same information.", items: ["Inquiry and tentative holds", "Proposals and confirmations", "Organization-defined event types"] },
    { title: "Availability and conflict protection", body: "Validate hall availability before committing the venue to a date and operating window.", details: "Bookings are scoped to the selected organization and hall. The booking engine evaluates active reservations, event timing, setup and cleanup windows, hold expiration, and event-type day restrictions to reduce accidental double-bookings.", items: ["Hall-aware validation", "Setup and cleanup windows", "Expiring tentative holds"] },
    { title: "Complete event workspace", body: "Move beyond a basic booking entry with a working file for every confirmed event.", details: "The Event Manager connects event details, menu selections, vendors, kitchen planning, dining arrangements, hall maps, client portal information, files, billing, payments, notes, and status history under the same event record.", items: ["Menu and vendor planning", "Kitchen and dining operations", "Files, billing, and client portal"] },
    { title: "Client and organization data", body: "Keep contact history and operational information tied to the correct organization.", details: "Client information can be reused across bookings while tenant isolation prevents records from leaking between organizations. Staff permissions control who can create bookings, view event information, or change operational details.", items: ["Reusable client profiles", "Organization isolation", "Role-based access"] },
    { title: "Operational handoff", body: "Give every department the same confirmed source of truth.", details: "Once a booking becomes an event, calendar, kitchen, dining, menu, billing, files, and staff workflows read from connected records. Teams spend less time reconciling spreadsheets and message threads before service begins." }
  ]
};
