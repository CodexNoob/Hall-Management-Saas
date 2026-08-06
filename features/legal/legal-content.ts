export const termsOfServiceIntroduction =
  "By using Event Core, you agree to the terms below. Please ensure your team follows these guidelines to maintain security, compliance, and data integrity.";

export const termsOfServiceSections = [
  {
    title: "Authorized use",
    body: "Use Event Core only for legitimate hall operations: bookings, events, menus, kitchen, dining, hall maps, files, billing, staff, clients, and vendors."
  },
  {
    title: "Account responsibility",
    body: "Each user is responsible for dashboard activity under their account, including invoices, event edits, files, notes, and staff permission changes."
  },
  {
    title: "Data accuracy",
    body: "Your organization is responsible for accurate booking dates, hall assignments, client/vendor records, menu counts, invoices, payments, and internal notes."
  }
] as const;

export const privacyPolicyIntroduction =
  "At Event Core, we are committed to protecting the privacy and security of your information. This policy explains how we collect, use, and safeguard your data.";

export const privacyPolicySections = [
  {
    title: "Operational data",
    body: "Event Core stores the operational data needed for dashboard modules: bookings, events, menus, kitchen plans, dining setup, hall maps, files, billing, staff, clients, and vendors."
  },
  {
    title: "Access control",
    body: "Dashboard roles and permissions should limit each staff member to the calendar, event, billing, files, settings, and operations data needed for their work."
  },
  {
    title: "Responsible handling",
    body: "Client names, event schedules, payment records, uploaded files, hall layouts, vendor details, and Today Notes should be treated as private business information."
  }
] as const;
