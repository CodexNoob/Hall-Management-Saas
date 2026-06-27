import { z } from "zod";

const booleanFlag = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET_LAYOUTS: z.string().default("event-layouts"),
  SUPABASE_STORAGE_BUCKET_PDFS: z.string().default("generated-pdfs"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  GMAIL_SENDER_EMAIL: z.string().optional(),
  GMAIL_ENCRYPTED_REFRESH_TOKEN: z.string().optional(),
  GMAIL_ALLOWED_SENDER_DOMAIN: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().optional(),
  GOOGLE_CALENDAR_ENCRYPTED_REFRESH_TOKEN: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  CARDKNOX_PAYMENT_LINK: z.string().url().default("https://secure.cardknox.com/belzcheiderevents"),
  ENABLE_GOOGLE_CALENDAR_SYNC: booleanFlag,
  ENABLE_GMAIL_PAYMENT_EMAILS: booleanFlag,
  ENABLE_PDF_GENERATION: booleanFlag.default("true"),
  ENABLE_SCHOOL_CYCLES: booleanFlag,
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info")
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  return envSchema.parse(process.env);
}
