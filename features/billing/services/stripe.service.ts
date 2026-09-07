import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { BillingError } from "@/features/billing/services/billing-error";
import { trackedFetch } from "@/lib/logging/outbound";

type StripeValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | StripeValue[]
  | { [key: string]: StripeValue };

function appendForm(form: URLSearchParams, key: string, value: StripeValue) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value))
    return value.forEach((item, index) =>
      appendForm(form, `${key}[${index}]`, item)
    );
  if (typeof value === "object")
    return Object.entries(value).forEach(([child, item]) =>
      appendForm(form, key ? `${key}[${child}]` : child, item)
    );
  form.append(key, String(value));
}

/**
 * The path with any Stripe object id folded away.
 *
 * Both call sites today pass a constant (`checkout/sessions`, `refunds`), but
 * half the API is `payment_intents/pi_.../capture`, and one such path added
 * later would turn a single timing series into one series per payment.
 */
function operationName(path: string) {
  return path.replace(/[a-z]{2,6}_[A-Za-z0-9]{6,}/g, ":id");
}

export function stripeConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET
  );
}

export async function stripeRequest<T>(
  path: string,
  body: Record<string, StripeValue>
): Promise<T> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret)
    throw new BillingError(
      "STRIPE_NOT_CONFIGURED",
      "Stripe is not configured. Add STRIPE_SECRET_KEY.",
      503
    );
  const form = new URLSearchParams();
  Object.entries(body).forEach(([key, value]) => appendForm(form, key, value));
  const response = await trackedFetch(
    { vendor: "stripe", operation: operationName(path) },
    `https://api.stripe.com/v1/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    }
  );
  const payload = (await response.json()) as T & {
    error?: { message?: string };
  };
  if (!response.ok)
    throw new BillingError(
      "STRIPE_REQUEST_FAILED",
      payload.error?.message ?? "Stripe request failed.",
      502
    );
  return payload;
}

export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  toleranceSeconds = 300
) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const parts = signatureHeader.split(",").map((part) => part.split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts
    .filter(([key]) => key === "v1")
    .map(([, value]) => value);
  if (
    !timestamp ||
    !signatures.length ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSeconds
  )
    return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return signatures.some((candidate) => {
    const left = Buffer.from(candidate, "hex");
    const right = Buffer.from(expected, "hex");
    return left.length === right.length && timingSafeEqual(left, right);
  });
}
