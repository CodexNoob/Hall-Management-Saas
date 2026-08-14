// @vitest-environment node
//
// Route handlers run on the server and need real Request/Response/Headers.
// jsdom, which vitest.config.ts sets globally for component tests, does not
// provide them.

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.fn();
const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { verifyOtp, exchangeCodeForSession }
  })
}));

const origin = "https://app.example.com";

/** Location, parsed, so assertions can talk about pathname and params. */
async function locationOf(response: Response) {
  const location = response.headers.get("location");
  expect(location, "handler must redirect").toBeTruthy();

  return new URL(location as string);
}

function sessionResult(session: unknown = { access_token: "token" }) {
  return { data: { session, user: { id: "user-1" } }, error: null };
}

async function confirm(query: string) {
  const { GET } = await import("@/app/auth/confirm/route");
  return GET(new NextRequest(`${origin}/auth/confirm${query}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyOtp.mockResolvedValue(sessionResult());
  exchangeCodeForSession.mockResolvedValue(sessionResult());
});

describe("email links (token_hash)", () => {
  it("sends an invite to password setup", async () => {
    const url = await locationOf(
      await confirm("?token_hash=hash-1&type=invite")
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      type: "invite",
      token_hash: "hash-1"
    });
    expect(url.pathname).toBe("/set-password");
    expect(url.searchParams.get("flow")).toBe("invite");
  });

  it("sends a recovery link to password setup", async () => {
    const url = await locationOf(
      await confirm("?token_hash=hash-1&type=recovery")
    );

    expect(url.pathname).toBe("/set-password");
    expect(url.searchParams.get("flow")).toBe("recovery");
  });

  /**
   * The link carries no `next` any more - a redirectTo with a query string
   * would collide with the `?token_hash=` the email template appends - so the
   * type alone has to route a confirmed owner to organization setup.
   */
  it("sends a confirmed signup to organization setup without being told to", async () => {
    const url = await locationOf(
      await confirm("?token_hash=hash-1&type=signup")
    );

    expect(url.pathname).toBe("/dashboard/new");
  });

  it("sends a magic link to the dashboard", async () => {
    const url = await locationOf(
      await confirm("?token_hash=hash-1&type=magiclink")
    );

    expect(url.pathname).toBe("/dashboard");
  });

  it("never carries the token hash onto the redirect", async () => {
    const url = await locationOf(
      await confirm("?token_hash=hash-1&type=signup")
    );

    expect(url.search).not.toContain("hash-1");
    expect(url.searchParams.get("token_hash")).toBeNull();
  });

  it("honours an explicit next but sanitizes it", async () => {
    const offsite = await locationOf(
      await confirm(
        `?token_hash=hash-1&type=magiclink&next=${encodeURIComponent("https://evil.example.com/steal")}`
      )
    );
    expect(offsite.origin).toBe(origin);
    expect(offsite.pathname).toBe("/dashboard");

    const onsite = await locationOf(
      await confirm(
        `?token_hash=hash-1&type=magiclink&next=${encodeURIComponent("/dashboard/menu")}`
      )
    );
    expect(onsite.pathname).toBe("/dashboard/menu");
  });

  it("rejects a type that is not one we support instead of passing it on", async () => {
    const url = await locationOf(
      await confirm("?token_hash=hash-1&type=not_a_real_type")
    );

    expect(url.pathname).toBe("/auth/auth-error");
    expect(url.searchParams.get("error_code")).toBe("unsupported_type");
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("passes a verification failure through with its code", async () => {
    verifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: "otp_expired", message: "Token has expired" }
    });

    const url = await locationOf(
      await confirm("?token_hash=hash-1&type=invite")
    );

    expect(url.pathname).toBe("/auth/auth-error");
    expect(url.searchParams.get("error_code")).toBe("otp_expired");
  });

  /**
   * "Secure email change" confirms the first address with error: null and
   * session: null. Treating that as success drops the user at login with
   * nothing to explain it.
   */
  it("does not treat a success that started no session as signed in", async () => {
    verifyOtp.mockResolvedValue({
      data: { session: null, user: { id: "user-1" } },
      error: null
    });

    const url = await locationOf(
      await confirm("?token_hash=hash-1&type=email_change")
    );

    expect(url.pathname).toBe("/auth/auth-error");
    expect(url.searchParams.get("error_code")).toBe("confirmation_pending");
  });
});

/**
 * A PKCE code reaches /auth/confirm from two directions: an OAuth return, and
 * any email link still routed through GoTrue's own /verify endpoint - which is
 * what every link looks like until the dashboard templates are switched over.
 * Rejecting a valid credential for arriving in the wrong shape was the original
 * bug this covers.
 */
describe("PKCE returns (code)", () => {
  it("exchanges a code that arrives with no type at all", async () => {
    const url = await locationOf(await confirm("?code=oauth-code"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
    expect(verifyOtp).not.toHaveBeenCalled();
    // No type to go on, so the dashboard gate decides: it redirects an
    // un-onboarded owner to /dashboard/new and a password-less account to
    // /set-password by itself.
    expect(url.pathname).toBe("/dashboard");
  });

  it("still honours a type when the link carries one", async () => {
    const url = await locationOf(
      await confirm("?code=oauth-code&type=recovery")
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
    expect(url.pathname).toBe("/set-password");
    expect(url.searchParams.get("flow")).toBe("recovery");
  });

  it("never carries the code onto the redirect", async () => {
    const url = await locationOf(await confirm("?code=oauth-code"));

    expect(url.search).not.toContain("oauth-code");
    expect(url.searchParams.get("code")).toBeNull();
  });

  it("sanitizes an off-site next", async () => {
    const url = await locationOf(
      await confirm(
        `?code=oauth-code&next=${encodeURIComponent("https://evil.example.com")}`
      )
    );

    expect(url.origin).toBe(origin);
    expect(url.pathname).toBe("/dashboard");
  });

  it("passes an exchange failure through with its code", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: "flow_state_not_found", message: "No flow state" }
    });

    const url = await locationOf(await confirm("?code=oauth-code"));

    expect(url.pathname).toBe("/auth/auth-error");
    expect(url.searchParams.get("error_code")).toBe("flow_state_not_found");
  });

  it("prefers the token hash when a link somehow carries both", async () => {
    await confirm("?token_hash=hash-1&type=invite&code=oauth-code");

    expect(verifyOtp).toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe("links carrying no usable credential", () => {
  /**
   * Doubles as the health check for the template cutover: /auth/confirm has to
   * answer before any email template is repointed at it.
   */
  it("redirects rather than 404s when the link carries nothing", async () => {
    const url = await locationOf(await confirm(""));

    expect(url.pathname).toBe("/auth/auth-error");
    expect(url.searchParams.get("error_code")).toBe("missing_token");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("keeps Supabase's own reason instead of reporting a missing token", async () => {
    const url = await locationOf(
      await confirm(
        "?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"
      )
    );

    expect(url.searchParams.get("error_code")).toBe("otp_expired");
    expect(url.searchParams.get("error_description")).toBe(
      "Email link is invalid or has expired"
    );
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});

/**
 * The two paths are one handler. A link must be judged on the credential it
 * carries, not on which path it happened to name - the original failure was an
 * entirely valid `?code=` link landing on /auth/confirm and being turned away.
 */
describe("/auth/callback", () => {
  it("is the same handler as /auth/confirm", async () => {
    const confirmRoute = await import("@/app/auth/confirm/route");
    const callbackRoute = await import("@/app/auth/callback/route");

    expect(callbackRoute.GET).toBe(confirmRoute.GET);
  });

  it("accepts a token hash, not just a code", async () => {
    const { GET } = await import("@/app/auth/callback/route");
    const url = await locationOf(
      await GET(
        new NextRequest(
          `${origin}/auth/callback?token_hash=hash-1&type=invite`
        )
      )
    );

    expect(verifyOtp).toHaveBeenCalled();
    expect(url.pathname).toBe("/set-password");
  });
});
