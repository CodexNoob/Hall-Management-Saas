import { z } from "zod";

const booleanFlag = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default("postgresql://localhost:5432/eventcore"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Required, not optional: cookie sessions put these on the request path for
  // every navigation, so a missing value is a hard misconfiguration rather than
  // a degraded feature. proxy.ts deliberately reads process.env directly
  // instead of getEnv() so one unset variable cannot 500 the public site.
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET_LAYOUTS: z.string().default("event-layouts"),
  SUPABASE_STORAGE_BUCKET_PDFS: z.string().default("generated-pdfs"),
  SUPABASE_STORAGE_BUCKET_FILES: z.string().default("event-files"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  PLAID_CLIENT_ID: z.string().optional(),
  PLAID_SECRET: z.string().optional(),
  PLAID_ENV: z.enum(["sandbox", "development", "production"]).default("sandbox"),
  GMAIL_SENDER_EMAIL: z.string().optional(),
  GMAIL_ENCRYPTED_REFRESH_TOKEN: z.string().optional(),
  GMAIL_ALLOWED_SENDER_DOMAIN: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().optional(),
  GOOGLE_CALENDAR_ENCRYPTED_REFRESH_TOKEN: z.string().optional(),
  // Google Drive mirroring for uploaded documents. Off unless all three are
  // set, in the same shape as the Gmail and Calendar integrations above: the
  // refresh token is encrypted with ENCRYPTION_KEY, never stored in the clear.
  // GOOGLE_DRIVE_FOLDER_ID is the parent everything is filed under, so the
  // integration can never touch the rest of that Drive.
  GOOGLE_DRIVE_ENCRYPTED_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  SUPPORT_EMAIL: z.string().email().optional(),
  RESEND_API_KEY: z.string().optional(),
  SUPPORT_EMAIL_FROM: z.string().optional(),
  SUPPORT_WEBHOOK_URL: z.string().url().optional(),
  // Deliberately optional with no default. The public client portal renders for
  // every organization, so a global payment link sent one venue's clients to
  // another venue's merchant account. Per-organization links live in
  // PaymentSetting.paymentLink; this variable survives only as the input to
  // scripts/backfill-payment-links.ts and can be removed once that has run.
  CARDKNOX_PAYMENT_LINK: z.string().url().optional(),
  ENABLE_GOOGLE_CALENDAR_SYNC: booleanFlag,
  ENABLE_GMAIL_PAYMENT_EMAILS: booleanFlag,
  ENABLE_PDF_GENERATION: booleanFlag.default("true"),
  ENABLE_SCHOOL_CYCLES: booleanFlag,
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info")
});

export type AppEnv = z.infer<typeof envSchema>;

// A variable that is declared but left blank (`SUPPORT_EMAIL=`) arrives as an
// empty string, and Zod treats that as present: `.optional()` and `.default()`
// only apply to `undefined`. Dropping blanks makes a declared-but-empty
// variable behave the same as an unset one.
function withoutBlankValues(source: NodeJS.ProcessEnv) {
  return Object.fromEntries(
    Object.entries(source).filter(
      ([, value]) => typeof value === "string" && value.trim() !== ""
    )
  );
}

export function getEnv(): AppEnv {
  const parsed = envSchema.safeParse(withoutBlankValues(process.env));

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid environment configuration - ${details}`);
  }

  return parsed.data;
}
