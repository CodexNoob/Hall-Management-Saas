import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listFactors: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  challengeAndVerify: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
  authenticatedFetch: vi.fn()
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      mfa: {
        listFactors: mocks.listFactors,
        enroll: mocks.enroll,
        unenroll: mocks.unenroll,
        challengeAndVerify: mocks.challengeAndVerify,
        getAuthenticatorAssuranceLevel: mocks.getAuthenticatorAssuranceLevel
      }
    }
  })
}));

vi.mock("@/lib/http/authenticated-fetch", () => ({
  authenticatedFetch: mocks.authenticatedFetch
}));

import { useTotpEnrollment } from "@/features/auth/hooks/use-totp-enrollment";

const messages = {
  loadFailed: "load failed",
  setupFailed: "setup failed",
  codeRejected: "code rejected",
  enterSixDigits: "enter six digits",
  emailCodeFailed: "email code failed",
  enterEmailCode: "enter the email code",
  setupExpired: "setup expired"
};

/**
 * Shaped the way supabase-js ACTUALLY answers: `all` holds every factor, and
 * `totp` holds only the VERIFIED ones. This helper used to put unverified
 * factors in `totp` too, which is why the stale-factor test passed while real
 * sign-ins hit "a factor with the friendly name ... already exists".
 */
const factors = (all: Array<{ id: string; status: string }>) => ({
  data: {
    all: all.map((factor) => ({ ...factor, factor_type: "totp" })),
    totp: all
      .filter((factor) => factor.status === "verified")
      .map((factor) => ({ ...factor, factor_type: "totp" }))
  },
  error: null
});

/** What each of our routes answers, per test. */
let server: {
  mfa: { trusted: boolean; removedUntrusted?: number };
  send: { ok: boolean; body: unknown };
  verify: { ok: boolean; body: unknown };
};

const json = (ok: boolean, body: unknown) => ({ ok, json: async () => body });

function mfaCalls() {
  return mocks.authenticatedFetch.mock.calls.filter(([url]) => url === "/api/me/mfa");
}

async function mounted() {
  const hook = renderHook(() => useTotpEnrollment({ messages }));

  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

  return hook;
}

/** Press "Set up", then enter the emailed code. */
async function throughEmail(result: { current: ReturnType<typeof useTotpEnrollment> }) {
  await act(() => result.current.begin());
  await waitFor(() => expect(result.current.emailStep).not.toBeNull());
  act(() => result.current.setEmailCode("654321"));
  await waitFor(() => expect(result.current.emailCode).toBe("654321"));

  return act(() => result.current.confirmEmail());
}

beforeEach(() => {
  vi.clearAllMocks();
  // A session that entered the code at sign-in, unless a test says otherwise.
  mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal2", nextLevel: "aal2" },
    error: null
  });
  server = {
    mfa: { trusted: true },
    send: {
      ok: true,
      body: { sentTo: "a•••@example.com", resendAvailableAt: "2026-09-26T12:01:00Z" }
    },
    verify: { ok: true, body: { verified: true } }
  };
  mocks.authenticatedFetch.mockImplementation(async (url: string) => {
    if (url === "/api/me/mfa") return json(true, server.mfa);
    if (url === "/api/me/security-code/send") return json(server.send.ok, server.send.body);
    if (url === "/api/me/security-code/verify") {
      return json(server.verify.ok, server.verify.body);
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  mocks.listFactors.mockResolvedValue(factors([]));
  mocks.enroll.mockResolvedValue({
    data: { id: "new-factor", totp: { qr_code: "data:image/svg+xml;utf-8,<svg/>", secret: "SECRET" } },
    error: null
  });
  mocks.unenroll.mockResolvedValue({ data: null, error: null });
  mocks.challengeAndVerify.mockResolvedValue({ data: null, error: null });
});

describe("email before the QR code", () => {
  /**
   * The point of Phase 1. Pressing "Set up" emails a code; no factor exists
   * and no QR is on screen until the server has accepted that code.
   */
  it("sends an email code and enrolls nothing when setup starts", async () => {
    const { result } = await mounted();
    await act(() => result.current.begin());

    expect(mocks.authenticatedFetch).toHaveBeenCalledWith(
      "/api/me/security-code/send",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.current.emailStep).toEqual({
      sentTo: "a•••@example.com",
      resendAvailableAt: "2026-09-26T12:01:00Z"
    });
    expect(mocks.enroll).not.toHaveBeenCalled();
    expect(result.current.enrollment).toBeNull();
  });

  it("shows no QR when the email code is rejected, and says why", async () => {
    server.verify = {
      ok: false,
      body: { error: "That code is not right. Check the email and try again." }
    };

    const { result } = await mounted();
    const confirmed = await throughEmail(result);

    expect(confirmed).toBe(false);
    expect(mocks.enroll).not.toHaveBeenCalled();
    expect(result.current.enrollment).toBeNull();
    expect(result.current.error).toBe(
      "That code is not right. Check the email and try again."
    );
  });

  it("does not check an email code that is not six digits", async () => {
    const { result } = await mounted();
    await act(() => result.current.begin());
    act(() => result.current.setEmailCode("12"));
    await waitFor(() => expect(result.current.emailCode).toBe("12"));
    await act(() => result.current.confirmEmail());

    expect(
      mocks.authenticatedFetch.mock.calls.some(
        ([url]) => url === "/api/me/security-code/verify"
      )
    ).toBe(false);
    expect(result.current.error).toBe("enter the email code");
  });

  it("exposes the QR code and secret only after the email code is accepted", async () => {
    const { result } = await mounted();
    await throughEmail(result);

    await waitFor(() =>
      expect(result.current.enrollment).toEqual({
        factorId: "new-factor",
        qrCode: "data:image/svg+xml;utf-8,<svg/>",
        secret: "SECRET"
      })
    );
    expect(result.current.emailStep).toBeNull();
  });
});

describe("enrolling after the email step", () => {
  /**
   * `enroll` creates the factor row straight away and leaves it unverified
   * until a code is accepted, so a reload or a closed tab strands one. Supabase
   * then refuses every later attempt with "a factor with the friendly name ...
   * already exists".
   */
  it("clears an abandoned unverified factor before enrolling again", async () => {
    mocks.listFactors.mockResolvedValue(
      factors([{ id: "stale", status: "unverified" }])
    );

    const { result } = await mounted();
    await throughEmail(result);

    expect(mocks.unenroll).toHaveBeenCalledWith({ factorId: "stale" });
    expect(mocks.enroll).toHaveBeenCalled();
  });

  it("never removes a verified factor", async () => {
    mocks.listFactors.mockResolvedValue(
      factors([{ id: "real", status: "verified" }])
    );

    const { result } = await mounted();
    await throughEmail(result);

    expect(mocks.unenroll).not.toHaveBeenCalled();
    expect(mocks.enroll).not.toHaveBeenCalled();
    expect(result.current.verifiedFactorId).toBe("real");
  });

  it("shows its own message, not Supabase's, when enrolment fails", async () => {
    mocks.enroll.mockResolvedValue({
      data: null,
      error: new Error(
        'A factor with the friendly name "Event Core Authenticator" for this user already exists'
      )
    });

    const { result } = await mounted();
    await throughEmail(result);

    await waitFor(() => expect(result.current.error).toBe("setup failed"));
  });
});

describe("telling the server", () => {
  it("reports a verified factor to the server", async () => {
    const { result } = await mounted();
    await throughEmail(result);
    await waitFor(() => expect(result.current.enrollment).not.toBeNull());

    const before = mfaCalls().length;
    act(() => result.current.setCode("123456"));
    await waitFor(() => expect(result.current.code).toBe("123456"));
    await act(() => result.current.verify());

    expect(mfaCalls().length).toBeGreaterThan(before);
  });

  /**
   * Supabase accepted the code, but the server did not trust the factor - the
   * grant ran out while the QR was on screen and the factor was removed. The
   * person must be told to start again, not told 2FA is on.
   */
  it("says setup expired when the server does not trust the new factor", async () => {
    const { result } = await mounted();
    await throughEmail(result);
    await waitFor(() => expect(result.current.enrollment).not.toBeNull());

    server.mfa = { trusted: false, removedUntrusted: 1 };
    act(() => result.current.setCode("123456"));
    await waitFor(() => expect(result.current.code).toBe("123456"));
    let verified: boolean | undefined;
    await act(async () => {
      verified = await result.current.verify();
    });

    expect(verified).toBe(false);
    expect(result.current.error).toBe("setup expired");
  });

  it("reports a removal too, which is the direction that can lock somebody out", async () => {
    mocks.listFactors.mockResolvedValue(
      factors([{ id: "real", status: "verified" }])
    );

    const { result } = await mounted();
    const before = mfaCalls().length;
    await act(() => result.current.disable());

    expect(mocks.unenroll).toHaveBeenCalledWith({ factorId: "real" });
    expect(mfaCalls().length).toBeGreaterThan(before);
  });

  /**
   * Signed in on a trusted device that remembers the authenticator: the
   * session is `aal1`, and Supabase refuses to unenroll from `aal1`. The hook
   * asks for the code instead of failing with a generic error.
   */
  it("asks for the code before removing a factor from an aal1 session", async () => {
    mocks.listFactors.mockResolvedValue(
      factors([{ id: "real", status: "verified" }])
    );
    mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null
    });

    const { result } = await mounted();
    let removed = true;
    await act(async () => {
      removed = await result.current.disable();
    });

    expect(removed).toBe(false);
    expect(result.current.stepUpRequired).toBe(true);
    expect(result.current.error).toBe("");
    expect(mocks.unenroll).not.toHaveBeenCalled();

    // Code entered: the session is aal2 now, and the retry goes through.
    mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal2", nextLevel: "aal2" },
      error: null
    });
    act(() => result.current.dismissStepUp());
    await act(async () => {
      removed = await result.current.disable();
    });

    expect(removed).toBe(true);
    expect(mocks.unenroll).toHaveBeenCalledWith({ factorId: "real" });
  });

  it("does not report anything when the code was rejected, and hides Supabase's wording", async () => {
    mocks.challengeAndVerify.mockResolvedValue({
      data: null,
      error: new Error("Invalid TOTP code entered")
    });

    const { result } = await mounted();
    await throughEmail(result);
    await waitFor(() => expect(result.current.enrollment).not.toBeNull());

    const before = mfaCalls().length;
    act(() => result.current.setCode("000000"));
    await waitFor(() => expect(result.current.code).toBe("000000"));
    await act(() => result.current.verify());

    expect(mfaCalls().length).toBe(before);
    expect(result.current.error).toBe("code rejected");
  });

  it("refuses a code that is not six digits without calling Supabase", async () => {
    const { result } = await mounted();
    await throughEmail(result);
    await waitFor(() => expect(result.current.enrollment).not.toBeNull());

    act(() => result.current.setCode("123"));
    await waitFor(() => expect(result.current.code).toBe("123"));
    await act(() => result.current.verify());

    expect(mocks.challengeAndVerify).not.toHaveBeenCalled();
  });

  it("does not call a factor enabled when the server does not trust it", async () => {
    // Supabase lists it as verified, but the server has not trusted it (and
    // is removing it). The panel must not show "Enabled".
    server.mfa = { trusted: false, removedUntrusted: 1 };
    mocks.listFactors.mockResolvedValue(
      factors([{ id: "planted", status: "verified" }])
    );

    const { result } = await mounted();

    expect(result.current.verifiedFactorId).toBeNull();
  });
});
