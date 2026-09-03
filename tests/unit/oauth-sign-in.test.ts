import { beforeEach, describe, expect, it, vi } from "vitest";

import { MVP_LANDING_ROUTE } from "@/lib/ui/mvp-features";

const signInWithOAuth = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithOAuth } }),
  clearAuthSessionCookies: vi.fn(),
  setActiveOrganizationCookie: vi.fn()
}));

import { signInWithOAuthProvider } from "@/lib/auth/client";

/** The redirect URL Supabase is told to come back to, parsed. */
function redirectTo() {
  const [payload] = signInWithOAuth.mock.calls[0];
  return new URL(payload.options.redirectTo);
}

beforeEach(() => {
  vi.clearAllMocks();
  signInWithOAuth.mockResolvedValue({ data: {}, error: null });
});

describe("signInWithOAuthProvider", () => {
  it("returns to the callback carrying the destination", async () => {
    await signInWithOAuthProvider("google");

    expect(redirectTo().pathname).toBe("/auth/callback");
    expect(redirectTo().searchParams.get("next")).toBe(MVP_LANDING_ROUTE);
  });

  it("asks Google which account, rather than reusing the last one", async () => {
    // Without this Google signs the browser straight back in as whoever it saw
    // last, so anyone signed into a personal account is authenticated as the
    // wrong person with nothing on screen to change it.
    await signInWithOAuthProvider("google");

    const [payload] = signInWithOAuth.mock.calls[0];
    expect(payload.options.queryParams).toEqual({ prompt: "select_account" });
  });

  it("carries the intent that lets a first sign-in open an organization", async () => {
    // A provider round trip cannot carry user metadata, so this is how the flag
    // that authorizes creating an organization survives it.
    await signInWithOAuthProvider("google", "/dashboard/events");

    expect(redirectTo().searchParams.get("intent")).toBe("organization");
    expect(redirectTo().searchParams.get("next")).toBe("/dashboard/events");
  });

  it("carries it from the login page too, not only from sign-up", async () => {
    // The regression this pins: /login used to omit the flag, so Google
    // authenticated the person successfully and provisioning then refused them.
    // One button signs in and signs up, because the provider knows no
    // difference between the two.
    await signInWithOAuthProvider("google");

    expect(redirectTo().searchParams.get("intent")).toBe("organization");
  });

  it("surfaces a provider failure rather than leaving the caller waiting", async () => {
    signInWithOAuth.mockResolvedValue({
      data: {},
      error: new Error("provider is not enabled")
    });

    await expect(signInWithOAuthProvider("google")).rejects.toThrow(
      "provider is not enabled"
    );
  });
});
