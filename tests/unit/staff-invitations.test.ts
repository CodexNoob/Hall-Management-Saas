import { describe, expect, it, vi } from "vitest";

import {
  generateStaffInviteLink,
  sendStaffInvitations,
  staffInviteRedirectTo,
  type StaffInviteClient
} from "@/features/administration/server/staff-invitations";

const redirectTo = "https://app.example.com/auth/confirm";

type LinkOutcome = { hashed_token?: string } | null;

/**
 * Stands in for supabase.auth.admin. `sendResults` is consumed one call at a
 * time so a test can make the first address succeed and the next one fail.
 */
function createAdminStub({
  sendResults = [],
  inviteLink = null,
  recoveryLink = null
}: {
  sendResults?: (string | null)[];
  inviteLink?: LinkOutcome;
  recoveryLink?: LinkOutcome;
} = {}) {
  const sends: string[] = [];
  const generated: { type: string; email: string }[] = [];
  let sendIndex = 0;

  const admin: StaffInviteClient = {
    inviteUserByEmail: async (email) => {
      sends.push(email);
      const failure = sendResults[sendIndex++] ?? null;
      return { error: failure ? { message: failure } : null };
    },
    generateLink: async ({ type, email }) => {
      generated.push({ type, email });
      const properties = type === "invite" ? inviteLink : recoveryLink;
      return { data: properties ? { properties } : null };
    }
  };

  return { admin, sends, generated };
}

describe("sendStaffInvitations", () => {
  it("reports a delivered invitation with no fallback link", async () => {
    const { admin, generated } = createAdminStub();

    const invitations = await sendStaffInvitations(
      admin,
      ["coordinator@example.com"],
      redirectTo
    );

    expect(invitations).toEqual([
      {
        email: "coordinator@example.com",
        emailSent: true,
        inviteLink: null,
        error: null
      }
    ]);
    // A delivered email owns the only valid token, so nothing may regenerate it.
    expect(generated).toEqual([]);
  });

  it("returns a shareable link instead of throwing when the email fails", async () => {
    const { admin } = createAdminStub({
      sendResults: ["email rate limit exceeded"],
      inviteLink: { hashed_token: "invite-token-hash" }
    });

    const invitations = await sendStaffInvitations(
      admin,
      ["coordinator@example.com"],
      redirectTo
    );

    expect(invitations).toEqual([
      {
        email: "coordinator@example.com",
        emailSent: false,
        inviteLink:
          "https://app.example.com/auth/confirm?token_hash=invite-token-hash&type=invite",
        error: "email rate limit exceeded"
      }
    ]);
  });

  it("keeps going after a failure so one bad address cannot sink the rest", async () => {
    const { admin, sends } = createAdminStub({
      sendResults: [null, "email rate limit exceeded", null],
      inviteLink: { hashed_token: "invite-token-hash" }
    });

    const invitations = await sendStaffInvitations(
      admin,
      ["first@example.com", "second@example.com", "third@example.com"],
      redirectTo
    );

    expect(sends).toEqual([
      "first@example.com",
      "second@example.com",
      "third@example.com"
    ]);
    expect(invitations.map((invite) => invite.emailSent)).toEqual([
      true,
      false,
      true
    ]);
    expect(invitations[1].inviteLink).toBe(
      "https://app.example.com/auth/confirm?token_hash=invite-token-hash&type=invite"
    );
  });

  it("sends one address at a time rather than as a parallel burst", async () => {
    const inFlight: string[] = [];
    let peak = 0;

    const admin: StaffInviteClient = {
      inviteUserByEmail: async (email) => {
        inFlight.push(email);
        peak = Math.max(peak, inFlight.length);
        await Promise.resolve();
        inFlight.pop();
        return { error: null };
      },
      generateLink: async () => ({ data: null })
    };

    await sendStaffInvitations(
      admin,
      ["a@example.com", "b@example.com", "c@example.com"],
      redirectTo
    );

    expect(peak).toBe(1);
  });

  it("passes the confirm redirect through to Supabase", async () => {
    const inviteUserByEmail = vi
      .fn()
      .mockResolvedValue({ error: null } as { error: null });

    await sendStaffInvitations(
      { inviteUserByEmail, generateLink: async () => ({ data: null }) },
      ["coordinator@example.com"],
      redirectTo
    );

    expect(inviteUserByEmail).toHaveBeenCalledWith("coordinator@example.com", {
      redirectTo
    });
  });

  it("returns an empty list for no addresses without touching Supabase", async () => {
    const { admin, sends } = createAdminStub();

    expect(await sendStaffInvitations(admin, [], redirectTo)).toEqual([]);
    expect(sends).toEqual([]);
  });
});

describe("generateStaffInviteLink", () => {
  it("prefers an invite link", async () => {
    const { admin, generated } = createAdminStub({
      inviteLink: { hashed_token: "invite-token-hash" }
    });

    expect(
      await generateStaffInviteLink(admin, "coordinator@example.com", redirectTo)
    ).toBe(
      "https://app.example.com/auth/confirm?token_hash=invite-token-hash&type=invite"
    );
    expect(generated).toEqual([
      { type: "invite", email: "coordinator@example.com" }
    ]);
  });

  it("falls back to recovery for an address Supabase already knows", async () => {
    const { admin, generated } = createAdminStub({
      inviteLink: null,
      recoveryLink: { hashed_token: "recovery-token-hash" }
    });

    expect(
      await generateStaffInviteLink(admin, "coordinator@example.com", redirectTo)
    ).toBe(
      "https://app.example.com/auth/confirm?token_hash=recovery-token-hash&type=recovery"
    );
    expect(generated.map((call) => call.type)).toEqual(["invite", "recovery"]);
  });

  /**
   * The whole point of building the link ourselves. Supabase's own action_link
   * is a GoTrue /verify URL that ignores the email templates, so a shareable
   * link taken from it would keep working only for as long as the transitional
   * implicit-flow page survives.
   */
  it("points at /auth/confirm rather than Supabase's own verify endpoint", async () => {
    const { admin } = createAdminStub({
      inviteLink: { hashed_token: "invite-token-hash" }
    });

    const link = await generateStaffInviteLink(
      admin,
      "coordinator@example.com",
      redirectTo
    );

    expect(link).toContain("/auth/confirm");
    expect(link).not.toContain("/auth/v1/verify");
  });

  it("escapes a token hash that is not URL safe", async () => {
    const { admin } = createAdminStub({
      inviteLink: { hashed_token: "abc+def/ghi=" }
    });

    expect(
      await generateStaffInviteLink(admin, "coordinator@example.com", redirectTo)
    ).toBe(
      "https://app.example.com/auth/confirm?token_hash=abc%2Bdef%2Fghi%3D&type=invite"
    );
  });

  it("returns null when neither link can be generated", async () => {
    const { admin } = createAdminStub({ inviteLink: null, recoveryLink: null });

    expect(
      await generateStaffInviteLink(admin, "coordinator@example.com", redirectTo)
    ).toBeNull();
  });

  it("ignores a response whose token hash is missing or blank", async () => {
    const { admin } = createAdminStub({
      inviteLink: {},
      recoveryLink: { hashed_token: "" }
    });

    expect(
      await generateStaffInviteLink(admin, "coordinator@example.com", redirectTo)
    ).toBeNull();
  });
});

describe("staffInviteRedirectTo", () => {
  it("appends the confirm path", () => {
    expect(staffInviteRedirectTo("https://app.example.com")).toBe(redirectTo);
  });

  it("does not double the slash when the app url has a trailing one", () => {
    expect(staffInviteRedirectTo("https://app.example.com/")).toBe(redirectTo);
  });
});
