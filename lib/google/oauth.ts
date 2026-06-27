import { google } from "googleapis";
import { decryptText } from "@/lib/security/crypto";
import { getEnv } from "@/lib/env";

export function createGoogleOAuthClient(encryptedRefreshToken: string) {
  const env = getEnv();

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI || !env.ENCRYPTION_KEY) {
    throw new Error("Google OAuth credentials are not configured.");
  }

  const client = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
  client.setCredentials({
    refresh_token: decryptText(encryptedRefreshToken, env.ENCRYPTION_KEY)
  });

  return client;
}
