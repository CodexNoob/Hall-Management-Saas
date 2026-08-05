import { getEnv } from "@/lib/env";

export type PlaidRuntimeConfig = {
  enabled: boolean;
  mode: "demo" | "sandbox" | "development" | "production";
  clientId: string | null;
  secret: string | null;
  baseUrl: string;
};

export function getPlaidRuntimeConfig(): PlaidRuntimeConfig {
  const env = getEnv();
  const clientId = env.PLAID_CLIENT_ID ?? null;
  const secret = env.PLAID_SECRET ?? null;
  const mode = clientId && secret ? env.PLAID_ENV : "demo";

  const baseUrl = mode === "demo"
    ? "https://sandbox.plaid.com"
    : {
        sandbox: "https://sandbox.plaid.com",
        development: "https://development.plaid.com",
        production: "https://production.plaid.com"
      }[mode];

  return {
    enabled: Boolean(clientId && secret),
    mode,
    clientId,
    secret,
    baseUrl
  };
}
