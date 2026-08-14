import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();
const getSession = vi.fn();
const signOut = vi.fn();
const syncSignedInUser = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn(), prefetch: vi.fn() })
}));

vi.mock("@/lib/http/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn()
}));

// Spread rather than listed: this suite runs the REAL @/lib/auth/client below,
// which reaches back into this module for its cookie helpers. Enumerating the
// exports here would break the moment another one is added.
vi.mock("@/lib/supabase/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/browser")>()),
  createSupabaseBrowserClient: () => ({ auth: { getSession, signOut } })
}));

// The prefill reads the real cache helper, so only the network-touching exports
// are replaced here.
vi.mock("@/lib/auth/client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/client")>();

  return {
    ...actual,
    syncSignedInUser: (...args: unknown[]) => syncSignedInUser(...args)
  };
});

import { ToastProvider } from "@/components/ui/toast";
import { CreateOrganizationPage } from "@/features/onboarding/components/create-organization-page";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { cacheSyncedUser } from "./synced-user-fixture";

function renderPage() {
  return render(
    <ToastProvider>
      <CreateOrganizationPage />
    </ToastProvider>
  );
}

function cachePendingOwner() {
  cacheSyncedUser("owner", {}, {
    userName: "carldelfin25",
    organizationName: "carldelfin25's Organization",
    onboardingCompletedAt: null
  });
}

describe("CreateOrganizationPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
      error: null
    });
    signOut.mockResolvedValue({ error: null });
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          organization: {
            id: "org-1",
            name: "Riverside Events",
            slug: "riverside-events-user-1",
            subscriptionPlan: "professional",
            subscriptionStatus: "trialing",
            onboardingCompletedAt: "2026-08-13T00:00:00.000Z"
          }
        }),
        { status: 200 }
      )
    );
  });

  it("prefills the placeholder organization name and the owner's name", () => {
    cachePendingOwner();
    renderPage();

    expect(screen.getByLabelText("Organization name")).toHaveValue(
      "carldelfin25's Organization"
    );
    expect(screen.getByLabelText("Your full name")).toHaveValue("carldelfin25");
  });

  it("offers the free trial plus every paid plan, defaulting to the free trial", () => {
    cachePendingOwner();
    renderPage();

    const plan = screen.getByLabelText("Plan");

    expect(plan).toHaveValue("free_trial");
    expect(
      screen.getByRole("option", { name: "Free Trial - $0/month" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Starter - $149/month" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Professional - $299/month" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Enterprise - $599/month" })
    ).toBeInTheDocument();
  });

  it("submits the entered details and lands on the dashboard", async () => {
    cachePendingOwner();
    renderPage();

    fireEvent.change(screen.getByLabelText("Organization name"), {
      target: { value: "Riverside Events" }
    });
    fireEvent.change(screen.getByLabelText("Your full name"), {
      target: { value: "Jordan Rivera" }
    });
    fireEvent.change(screen.getByLabelText("Phone number"), {
      target: { value: "212 555 0142" }
    });
    fireEvent.change(screen.getByLabelText("Plan"), {
      target: { value: "professional" }
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create organization" })
    );

    await waitFor(() =>
      expect(vi.mocked(authenticatedFetch)).toHaveBeenCalledWith(
        "/api/onboarding/organization",
        expect.objectContaining({ method: "POST" })
      )
    );

    const [, init] = vi.mocked(authenticatedFetch).mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      organizationName: "Riverside Events",
      fullName: "Jordan Rivera",
      // Sent as E.164, not as the digits the user typed.
      phone: "+12125550142",
      plan: "professional"
    });

    // The sidebar and route guard read the cached payload, so it has to be
    // rebuilt before leaving - otherwise the dashboard shows the placeholder name.
    await waitFor(() =>
      expect(syncSignedInUser).toHaveBeenCalledWith("access-token", {
        force: true
      })
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  describe("phone validation", () => {
    function fillRequiredFields() {
      fireEvent.change(screen.getByLabelText("Organization name"), {
        target: { value: "Riverside Events" }
      });
      fireEvent.change(screen.getByLabelText("Your full name"), {
        target: { value: "Jordan Rivera" }
      });
    }

    function submitWithPhone(phone: string, country?: string) {
      cachePendingOwner();
      renderPage();
      fillRequiredFields();

      if (country) {
        fireEvent.change(screen.getByLabelText("Country"), {
          target: { value: country }
        });
      }

      fireEvent.change(screen.getByLabelText("Phone number"), {
        target: { value: phone }
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Create organization" })
      );
    }

    it("does not let letters into the phone field in the first place", async () => {
      // The reported defect, now handled a step earlier: rather than accepting
      // letters and failing on submit, the field refuses them as they are
      // typed and says why. Nothing letter-shaped can reach the server.
      cachePendingOwner();
      renderPage();
      fillRequiredFields();

      const phone = screen.getByLabelText("Phone number");
      fireEvent.change(phone, { target: { value: "abcdefghij" } });

      expect(phone).toHaveValue("");
      // The notice lands on a later task so the live region is cleared first
      // and the message is actually re-announced each time.
      expect(
        await screen.findByText(/can only contain digits/i)
      ).toBeInTheDocument();
    });

    it("keeps a half-valid entry out of the request", async () => {
      // Digits that are not a real number still have to be caught at submit.
      submitWithPhone("212555");

      await waitFor(() =>
        expect(screen.getAllByRole("alert").length).toBeGreaterThan(0)
      );
      expect(vi.mocked(authenticatedFetch)).not.toHaveBeenCalled();
    });

    it("refuses a number that is too short for the chosen country", async () => {
      submitWithPhone("12345");

      await waitFor(() =>
        expect(vi.mocked(authenticatedFetch)).not.toHaveBeenCalled()
      );
    });

    it("refuses a number that is impossible in the chosen country", async () => {
      // Ten digits is a valid US number and an impossible UK one, so this only
      // fails if the country picker is genuinely driving the rules.
      submitWithPhone("212 555 0142", "GB");

      await waitFor(() =>
        expect(vi.mocked(authenticatedFetch)).not.toHaveBeenCalled()
      );
    });

    it("accepts the same digits once the matching country is chosen", async () => {
      submitWithPhone("9171234567", "PH");

      await waitFor(() =>
        expect(vi.mocked(authenticatedFetch)).toHaveBeenCalled()
      );

      const [, init] = vi.mocked(authenticatedFetch).mock.calls[0];
      expect(JSON.parse(String(init?.body)).phone).toBe("+639171234567");
    });

    it("still allows the field to be left empty", async () => {
      submitWithPhone("");

      await waitFor(() =>
        expect(vi.mocked(authenticatedFetch)).toHaveBeenCalled()
      );

      const [, init] = vi.mocked(authenticatedFetch).mock.calls[0];
      expect(JSON.parse(String(init?.body)).phone).toBeUndefined();
    });
  });

  it("omits an empty phone number rather than sending a bare country code", async () => {
    cachePendingOwner();
    renderPage();

    fireEvent.change(screen.getByLabelText("Organization name"), {
      target: { value: "Riverside Events" }
    });
    fireEvent.change(screen.getByLabelText("Your full name"), {
      target: { value: "Jordan Rivera" }
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create organization" })
    );

    await waitFor(() =>
      expect(vi.mocked(authenticatedFetch)).toHaveBeenCalled()
    );

    const [, init] = vi.mocked(authenticatedFetch).mock.calls[0];
    expect(JSON.parse(String(init?.body)).phone).toBeUndefined();
  });

  it("blocks submission until the required names are filled in", async () => {
    cacheSyncedUser("owner", {}, {
      organizationName: "",
      userName: "",
      onboardingCompletedAt: null
    });
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Create organization" })
    );

    // Reported twice on purpose: inline next to the form and as a toast.
    await waitFor(() =>
      expect(
        screen.getAllByText("Please enter your organization name.")
      ).toHaveLength(2)
    );
    expect(vi.mocked(authenticatedFetch)).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("surfaces a server rejection instead of navigating away", async () => {
    cachePendingOwner();
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(
        JSON.stringify({ error: "This organization has already been set up." }),
        { status: 409 }
      )
    );
    renderPage();

    fireEvent.change(screen.getByLabelText("Organization name"), {
      target: { value: "Riverside Events" }
    });
    fireEvent.change(screen.getByLabelText("Your full name"), {
      target: { value: "Jordan Rivera" }
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create organization" })
    );

    // The 409 body is surfaced verbatim, not swallowed behind generic copy.
    await waitFor(() =>
      expect(
        screen.getAllByText("This organization has already been set up.")
      ).toHaveLength(2)
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
