import type { PublicPageContent } from "@/features/landing/public-pages/types";

export const paymentsPage: PublicPageContent = {
  eyebrow: "Product",
  title: "Payments",
  headline: "Keep every invoice, payment, balance, and refund accountable.",
  description: "Run event billing through a controlled financial workflow with persistent transactions, payment history, permissions, and reporting.",
  sections: [
    { title: "Professional invoice lifecycle", body: "Create event-linked invoices and manage their status from initial draft through final settlement.", details: "Invoices support client information, due dates, line items, quantities, unit amounts, balances, and status history. Teams can move records through Draft, Sent, Partially Paid, Paid, Overdue, or Cancelled without losing the audit trail.", items: ["Detailed line items", "Due dates and balances", "Status and edit history"] },
    { title: "Accurate payment posting", body: "Record full or partial payments against the correct invoice and event.", details: "Payment entries capture amount, method, reference, date, and notes. Invoice balances and payment states are recalculated by server-side operations so changes persist after refresh and remain consistent for authorized staff.", items: ["Partial payments", "Provider references", "Persistent balance updates"] },
    { title: "Transaction review and reconciliation", body: "Review financial activity separately from invoices while retaining links to the operational record.", details: "Transactions can be searched, filtered, categorized, matched, split, cancelled, imported, or exported. Long provider references are retained for reconciliation, and organization-scoped API operations prevent client-only changes from disappearing." },
    { title: "Refunds and controls", body: "Protect sensitive actions with billing permissions and recorded activity.", details: "Refunds, invoice editing, payment posting, and transaction changes require the appropriate organization role. Server-side audit records capture the actor and action for later review.", items: ["Permission-gated actions", "Refund recording", "Actor and status history"] },
    { title: "Reporting and payment providers", body: "Understand revenue and outstanding balances, then connect secure payment processing when ready.", details: "Billing reports summarize revenue, aging invoices, outstanding balances, and refunds. Stripe configuration supports hosted checkout and verified webhooks, while Plaid-supported connections and bank-file imports can assist transaction review." }
  ]
};
