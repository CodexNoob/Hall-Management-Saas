import { google } from "googleapis";
import { createGoogleOAuthClient } from "@/lib/google/oauth";
import { getEnv } from "@/lib/env";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

function encodeMessage(input: SendEmailInput & { from: string }) {
  const message = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    input.html
  ].join("\r\n");

  return Buffer.from(message).toString("base64url");
}

export async function sendGmailMessage(input: SendEmailInput) {
  const env = getEnv();

  if (!env.ENABLE_GMAIL_PAYMENT_EMAILS) {
    return { skipped: true as const };
  }

  if (!env.GMAIL_SENDER_EMAIL || !env.GMAIL_ENCRYPTED_REFRESH_TOKEN) {
    throw new Error("Gmail integration is not configured.");
  }

  if (env.GMAIL_ALLOWED_SENDER_DOMAIN && !env.GMAIL_SENDER_EMAIL.endsWith(`@${env.GMAIL_ALLOWED_SENDER_DOMAIN}`)) {
    throw new Error("Configured Gmail sender is outside the allowed domain.");
  }

  const auth = createGoogleOAuthClient(env.GMAIL_ENCRYPTED_REFRESH_TOKEN);
  const gmail = google.gmail({ version: "v1", auth });

  const sent = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodeMessage({ ...input, from: env.GMAIL_SENDER_EMAIL })
    }
  });

  return { skipped: false as const, messageId: sent.data.id };
}
