import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
const signUp = vi.fn();
const syncSignedInUser = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh, replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search)
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signUp } })
}));

vi.mock("@/lib/auth/client", () => ({
  syncSignedInUser: (...args: unknown[]) => syncSignedInUser(...args)
}));

import { ToastProvider } from "@/components/ui/toast";
import { FreeTrialCard } from "@/features/auth/components/free-trial-card";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth/auth-error-messages";
import { MAX_PASSWORD_LENGTH } from "@/lib/auth/password";

const fetchMock = vi.fn();

function renderSignUp() {
  return render(
    <ToastProvider>
      <FreeTrialCard />
    </ToastProvider>
  );
}

function fill(email: string, password: string) {
  if (email) {
    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: email }
    });
  }
  if (password) {
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: password }
    });
  }
}

function submitForm() {
  // Through the form, so the native type="email" guard cannot mask the
  // component's own validation.
  const button = screen.getByRole("button", { name: "Create account" });
  fireEvent.submit(button.closest("form")!);
}

/** Every sign-up failure renders twice: inline and as a toast. */
function expectReportedTwice(message: string) {
  return waitFor(() => expect(screen.getAllByText(message)).toHaveLength(2));
}

function signUpFailure(error: Record<string, unknown>) {
  return { data: { user: null, session: null }, error };
}

describe("FreeTrialCard failure paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ allowed: true }), { status: 200 })
    );
    signUp.mockResolvedValue({
      data: { user: { id: "user-1" }, session: null },
      error: null
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("asks for an email before touching the network", async () => {
    renderSignUp();
    submitForm();

    await expectReportedTwice("Please enter your email address.");
    expect(screen.getByText("Sign-up failed")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(signUp).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("blocks a malformed address before the access gate", async () => {
    renderSignUp();
    fill("not-an-email", "Testing12345");
    submitForm();

    await expectReportedTwice(AUTH_ERROR_MESSAGES.invalidEmail);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than eight characters", async () => {
    renderSignUp();
    fill("owner@example.com", "short1");
    submitForm();

    await expectReportedTwice("Use at least 8 characters.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a password with no number", async () => {
    renderSignUp();
    fill("owner@example.com", "passwordonly");
    submitForm();

    await expectReportedTwice("Include at least one number.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a password with no letter", async () => {
    renderSignUp();
    fill("owner@example.com", "12345678");
    submitForm();

    await expectReportedTwice("Include at least one letter.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a password past the bcrypt limit before any email is sent", async () => {
    renderSignUp();
    fill("owner@example.com", `a1${"x".repeat(MAX_PASSWORD_LENGTH)}`);
    submitForm();

    await expectReportedTwice(
      `Passwords cannot be longer than ${MAX_PASSWORD_LENGTH} characters.`
    );
    expect(signUp).not.toHaveBeenCalled();
  });

  it("surfaces a free-trial-access rejection verbatim", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Free trial access is not available for this email."
        }),
        { status: 403 }
      )
    );
    renderSignUp();
    fill("owner@example.com", "Testing12345");
    submitForm();

    await expectReportedTwice(
      "Free trial access is not available for this email."
    );
    expect(signUp).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("falls back to generic copy when the gate answers without JSON", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>502</html>", { status: 502 })
    );
    renderSignUp();
    fill("owner@example.com", "Testing12345");
    submitForm();

    await expectReportedTwice(
      "Unable to create your account right now. Please try again."
    );
  });

  it("tells an existing owner to sign in instead of creating a duplicate", async () => {
    signUp.mockResolvedValue(
      signUpFailure({
        code: "user_already_exists",
        status: 400,
        message: "User already registered"
      })
    );
    renderSignUp();
    fill("owner@example.com", "Testing12345");
    submitForm();

    await expectReportedTwice(AUTH_ERROR_MESSAGES.emailAlreadyRegistered);
    // Must not look like success by landing on the confirm-email page.
    expect(push).not.toHaveBeenCalled();
  });

  it("reports Supabase's own weak-password rejection", async () => {
    signUp.mockResolvedValue(
      signUpFailure({ code: "weak_password", status: 422 })
    );
    renderSignUp();
    fill("owner@example.com", "Testing12345");
    submitForm();

    await expectReportedTwice(AUTH_ERROR_MESSAGES.weakPassword);
  });

  it("explains that sign-ups are closed", async () => {
    signUp.mockResolvedValue(signUpFailure({ code: "signup_disabled" }));
    renderSignUp();
    fill("owner@example.com", "Testing12345");
    submitForm();

    await expectReportedTwice(AUTH_ERROR_MESSAGES.signUpDisabled);
  });

  it("separates email-send throttling from a rejected account", async () => {
    signUp.mockResolvedValue(
      signUpFailure({ code: "over_email_send_rate_limit" })
    );
    renderSignUp();
    fill("owner@example.com", "Testing12345");
    submitForm();

    await expectReportedTwice(AUTH_ERROR_MESSAGES.emailSendRateLimited);
  });

  it("keeps the owner on the form when the network throws", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    renderSignUp();
    fill("owner@example.com", "Testing12345");
    submitForm();

    await expectReportedTwice("Failed to fetch");
    expect(signUp).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("does not create two accounts from a double submit", async () => {
    let resolveGate: (value: unknown) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveGate = resolve;
      })
    );
    renderSignUp();
    fill("owner@example.com", "Testing12345");
    submitForm();

    const pending = await screen.findByRole("button", {
      name: "Creating account..."
    });
    expect(pending).toBeDisabled();

    resolveGate(new Response(JSON.stringify({ allowed: true }), { status: 200 }));
    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("FreeTrialCard success path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ allowed: true }), { status: 200 })
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("posts the address to the access gate", async () => {
    signUp.mockResolvedValue({
      data: { user: { id: "user-1" }, session: null },
      error: null
    });
    renderSignUp();
    fill("  owner@example.com  ", "Testing12345");
    submitForm();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/free-trial-access");
    expect(JSON.parse(String(init.body)).email).toBe("owner@example.com");
  });

  it("sends an unconfirmed owner to the verify-email page", async () => {
    signUp.mockResolvedValue({
      data: { user: { id: "user-1" }, session: null },
      error: null
    });
    renderSignUp();
    fill("owner+trial@example.com", "Testing12345");
    submitForm();

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/verify-email?email=owner%2Btrial%40example.com"
      )
    );
    expect(syncSignedInUser).not.toHaveBeenCalled();
  });

  it("claims organization ownership on the account it creates", async () => {
    signUp.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
      error: null
    });
    syncSignedInUser.mockResolvedValue(undefined);
    renderSignUp();
    fill("owner@example.com", "Testing12345");
    submitForm();

    await waitFor(() => expect(signUp).toHaveBeenCalled());

    // The only signal that authorizes the server to provision an organization.
    const [payload] = signUp.mock.calls[0];
    expect(payload.options.data.account_type).toBe("organization_owner");
    expect(payload.options.emailRedirectTo).toContain(
      "/auth/callback?next=%2Fdashboard%2Fnew"
    );

    await waitFor(() =>
      expect(syncSignedInUser).toHaveBeenCalledWith("access-token", {
        force: true
      })
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/new"));
  });
});
