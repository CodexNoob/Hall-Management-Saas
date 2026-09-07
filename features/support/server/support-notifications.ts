import "server-only";
import { log } from "@/lib/logging/context";
import { trackedFetch } from "@/lib/logging/outbound";

type TicketNotification = {
  reference: string;
  subject: string;
  priority: string;
  category: string;
  organizationName: string;
  reporterName: string;
  reporterEmail: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    };
    return entities[character] ?? character;
  });
}

async function sendEmail({ to, subject, html, replyTo }: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SUPPORT_EMAIL_FROM;
  if (!apiKey || !from) return false;
  const response = await trackedFetch(
    { vendor: "resend", operation: "emails.send" },
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, reply_to: replyTo })
    }
  );
  if (!response.ok) throw new Error(`Support email failed (${response.status}).`);
  return true;
}

export async function notifySupportTicketCreated(ticket: TicketNotification) {
  const safeReference = escapeHtml(ticket.reference);
  const safeSubject = escapeHtml(ticket.subject);
  const tasks: Promise<unknown>[] = [];
  if (process.env.SUPPORT_EMAIL) {
    tasks.push(sendEmail({
      to: process.env.SUPPORT_EMAIL,
      replyTo: ticket.reporterEmail,
      subject: `[${ticket.priority}] ${ticket.reference}: ${ticket.subject}`,
      html: `<h2>New Event Core support ticket</h2><p><strong>Reference:</strong> ${safeReference}</p><p><strong>Organization:</strong> ${escapeHtml(ticket.organizationName)}</p><p><strong>Reporter:</strong> ${escapeHtml(ticket.reporterName)} (${escapeHtml(ticket.reporterEmail)})</p><p><strong>Category:</strong> ${escapeHtml(ticket.category)}</p><p><strong>Subject:</strong> ${safeSubject}</p>`
    }));
  }
  tasks.push(sendEmail({
    to: ticket.reporterEmail,
    subject: `${ticket.reference}: We received your Event Core support request`,
    html: `<h2>Support request received</h2><p>We received your request: <strong>${safeSubject}</strong>.</p><p>Your reference number is <strong>${safeReference}</strong>.</p>`
  }));
  if (process.env.SUPPORT_WEBHOOK_URL) {
    // The URL is operator-configured and never logged - `operation` is what the
    // timing groups by, and a webhook URL is frequently a bearer token in path
    // form (Slack and Teams both work that way).
    tasks.push(trackedFetch(
      { vendor: "webhook", operation: "support.ticket.created" },
      process.env.SUPPORT_WEBHOOK_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "support.ticket.created",
          reference: ticket.reference,
          subject: ticket.subject,
          priority: ticket.priority,
          category: ticket.category,
          organization: ticket.organizationName
        })
      }
    ));
  }
  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === "rejected")
      log.error({ reason: String(result.reason) }, "support_notification_failed");
  });
}

export async function notifyPublicSupportRequest(request: {
  reference: string;
  name: string;
  email: string;
  company?: string | null;
  message: string;
}) {
  const tasks: Promise<unknown>[] = [];
  if (process.env.SUPPORT_EMAIL) {
    tasks.push(sendEmail({
      to: process.env.SUPPORT_EMAIL,
      replyTo: request.email,
      subject: `[Public support] ${request.reference}: ${request.name}`,
      html: `<h2>New Event Core contact request</h2><p><strong>Reference:</strong> ${escapeHtml(request.reference)}</p><p><strong>From:</strong> ${escapeHtml(request.name)} (${escapeHtml(request.email)})</p><p><strong>Company:</strong> ${escapeHtml(request.company || "Not provided")}</p><p><strong>Message:</strong></p><p>${escapeHtml(request.message).replaceAll("\n", "<br>")}</p>`
    }));
  }
  tasks.push(sendEmail({
    to: request.email,
    subject: `${request.reference}: We received your Event Core support request`,
    html: `<h2>Support request received</h2><p>Thank you, ${escapeHtml(request.name)}. Your request was received.</p><p>Your reference number is <strong>${escapeHtml(request.reference)}</strong>.</p>`
  }));
  if (process.env.SUPPORT_WEBHOOK_URL) {
    tasks.push(trackedFetch(
      { vendor: "webhook", operation: "support.public_request.created" },
      process.env.SUPPORT_WEBHOOK_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "support.public_request.created",
          reference: request.reference,
          name: request.name,
          email: request.email,
          company: request.company
        })
      }
    ));
  }
  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === "rejected")
      log.error(
        { reason: String(result.reason) },
        "public_support_notification_failed"
      );
  });
}
