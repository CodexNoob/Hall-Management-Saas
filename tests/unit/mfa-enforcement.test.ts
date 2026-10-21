import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    serviceAccount: { findUnique: vi.fn() }
  },
  resolveAuthIdentity: vi.fn(),
  cookies: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

vi.mock("next/headers", () => ({
  cookies: () => mocks.cookies()
}));

vi.mock("@/lib/auth/identity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/identity")>()),
  resolveAuthIdentity: (...args: unknown[]) =>
    mocks.resolveAuthIdentity(...args)
}));

import { AuthorizationError } from "@/lib/auth/errors";
import { authorizeMember } from "@/lib/authz/authorize";
import {
  hasVerifiedFactor,
  mfaObligation,
  syncMfaEnrollment
} from "@/lib/auth/mfa";

/**
 * TWO-FACTOR AUTHENTICATION, ON THE SIDE THAT COUNTS.
 *
 * The dialog at sign-in is a convenience. `signInWithPassword` mints a valid
 * session before any code is entered, so anything that only the browser
 * performs is a step an API client simply does not take. These cover the
 * server's refusal, which is the actual control.
 */

const ORGANIZATION = "11111111-1111-4111-8111-111111111111";
const PRINCIPAL = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";

/**
 * THIS browser's device row, relative to the real clock - `resolveUserActor`
 * reads `new Date()`, so fixed dates would drift out of the trust period.
 *
 *   trusted    - confirmed yesterday, trusted for 29 more days.
 *   remembered - trusted, and the authenticator was entered on it yesterday.
 *   expired    - confirmed (and the code entered) 31 days ago; trust ended.
 *   untrusted  - seen, never confirmed.
 *   revoked    - removed from My Account; its memory is kept here only to
 *                prove a removal ignores it.
 */
type DeviceFixture =
  | "trusted"
  | "remembered"
  | "expired"
  | "untrusted"
  | "revoked"
  | "none";

const DAY_MS = 24 * 60 * 60_000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

type DeviceRow = {
  confirmedAt: Date | null;
  revokedAt: Date | null;
  trustExpiresAt: Date | null;
  mfaVerifiedAt: Date | null;
};

function deviceRow(device: Exclude<DeviceFixture, "none">): DeviceRow {
  switch (device) {
    case "untrusted":
      return {
        confirmedAt: null,
        revokedAt: null,
        trustExpiresAt: null,
        mfaVerifiedAt: null
      };
    case "expired":
      return {
        confirmedAt: daysFromNow(-31),
        revokedAt: null,
        trustExpiresAt: daysFromNow(-1),
        mfaVerifiedAt: daysFromNow(-31)
      };
    case "revoked":
      return {
        confirmedAt: daysFromNow(-1),
        revokedAt: daysFromNow(0),
        trustExpiresAt: daysFromNow(29),
        mfaVerifiedAt: daysFromNow(-1)
      };
    default:
      return {
        confirmedAt: daysFromNow(-1),
        revokedAt: null,
        trustExpiresAt: daysFromNow(29),
        mfaVerifiedAt: device === "remembered" ? daysFromNow(-1) : null
      };
  }
}

/** Enrolled well before the device remembered the code. */
const ENROLLED_EARLIER = () => daysFromNow(-10);

function userRow(input: {
  mfaEnrolledAt: Date | null;
  twoFactorRequired: boolean;
  sessionTimeoutMinutes?: number;
  lastActiveAt?: Date | null;
  sharedDevice?: boolean;
  device?: DeviceFixture;
}) {
  const device = input.device ?? "trusted";

  return {
    id: USER,
    name: "Test User",
    email: "user@example.com",
    isActive: true,
    organizationId: ORGANIZATION,
    mfaEnrolledAt: input.mfaEnrolledAt,
    // THIS browser's device row, joined like the session below. Trusted by
    // default so the two-factor tests measure the two-factor rule.
    devices: device === "none" ? [] : [deviceRow(device)],
    // This request's own session row, joined onto the same query. Empty by
    // default: no recorded activity means the inactivity check cannot tell,
    // and cannot-tell fails open - so these two-factor tests measure the
    // two-factor rule and nothing else.
    sessions:
      input.lastActiveAt === undefined && input.sharedDevice === undefined
        ? []
        : [
            {
              lastActiveAt: input.lastActiveAt ?? null,
              sharedDevice: input.sharedDevice ?? false
            }
          ],
    memberships: [
      {
        isActive: true,
        principalId: PRINCIPAL,
        organizationId: ORGANIZATION,
        organization: {
          id: ORGANIZATION,
          name: "Test Organization",
          slug: "test-organization",
          isActive: true,
          subscriptionPlan: null,
          subscriptionStatus: "active",
          permissionsEpoch: BigInt(1),
          settings: {
            twoFactorRequired: input.twoFactorRequired,
            sessionTimeoutMinutes: input.sessionTimeoutMinutes ?? 0
          }
        },
        principal: { isActive: true }
      }
    ]
  };
}

async function member(input: {
  assuranceLevel: "aal1" | "aal2" | null;
  mfaEnrolledAt?: Date | null;
  twoFactorRequired?: boolean;
  allowUnsatisfiedMfa?: boolean;
  allowUnconfirmedDevice?: boolean;
  sessionTimeoutMinutes?: number;
  lastActiveAt?: Date | null;
  sharedDevice?: boolean;
  device?: DeviceFixture;
}) {
  mocks.resolveAuthIdentity.mockResolvedValue({
    id: "supabase-id",
    email: "user@example.com",
    assuranceLevel: input.assuranceLevel,
    sessionId: "sess-1"
  });
  mocks.prisma.user.findUnique.mockResolvedValue(
    userRow({
      mfaEnrolledAt: input.mfaEnrolledAt ?? null,
      twoFactorRequired: input.twoFactorRequired ?? false,
      sessionTimeoutMinutes: input.sessionTimeoutMinutes,
      lastActiveAt: input.lastActiveAt,
      sharedDevice: input.sharedDevice,
      device: input.device
    })
  );

  return authorizeMember(undefined, {
    allowUnsatisfiedMfa: input.allowUnsatisfiedMfa,
    allowUnconfirmedDevice: input.allowUnconfirmedDevice
  });
}

/** The code the refusal carried, or null if it did not refuse. */
async function refusalCode(promise: Promise<unknown>) {
  try {
    await promise;

    return null;
  } catch (error) {
    return error instanceof AuthorizationError
      ? error.code
      : "not-an-authz-error";
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({ get: () => undefined });
});

describe("mfaObligation", () => {
  const ask = (
    assuranceLevel: "aal1" | "aal2" | null,
    enrolled: boolean,
    requiredByOrganization: boolean
  ) => mfaObligation({ assuranceLevel, enrolled, requiredByOrganization });

  it("is satisfied by a session that cleared a factor", () => {
    expect(ask("aal2", true, true)).toBe("satisfied");
  });

  it("asks for a code when a factor exists and this session skipped it", () => {
    expect(ask("aal1", true, false)).toBe("challenge");
  });

  it("asks for enrolment only when the organization requires one", () => {
    expect(ask("aal1", false, true)).toBe("enroll");
    expect(ask("aal1", false, false)).toBe("satisfied");
  });

  /**
   * The failure mode worth naming. A token whose `aal` claim is missing or
   * unrecognised tells us nothing, and "nothing" has to mean "did not clear a
   * factor" - otherwise an unfamiliar token shape is a way past the check.
   */
  it("treats an unreadable assurance level as aal1, never as aal2", () => {
    expect(ask(null, true, false)).toBe("challenge");
    expect(ask(null, false, true)).toBe("enroll");
  });

  /**
   * A factor somebody set up for themselves is honoured even where no policy
   * demands one. Reading `requiredByOrganization` first would mean an
   * organization that does not mandate 2FA silently ignores the 2FA its staff
   * turned on.
   */
  it("honours a personal factor in an organization that does not require one", () => {
    expect(ask("aal1", true, false)).toBe("challenge");
    expect(ask("aal2", true, false)).toBe("satisfied");
  });

  /**
   * THE HOLE PHASE 1 CLOSES. `enrolled` means a TRUSTED factor. Supabase hands
   * out `aal2` for ANY verified factor - including one attached with a stolen
   * password - so `aal2` with no trusted factor behind it must not satisfy a
   * policy that requires 2FA. It lands on protected enrolment instead, which
   * needs the account's inbox.
   */
  it("does not let aal2 from an untrusted factor satisfy a required policy", () => {
    expect(ask("aal2", false, true)).toBe("enroll");
  });

  it("leaves aal2 with no trusted factor alone where 2FA is optional", () => {
    // The password alone already got them this far; nothing to add.
    expect(ask("aal2", false, false)).toBe("satisfied");
  });
});

describe("hasVerifiedFactor", () => {
  it("ignores a factor that was never verified", () => {
    // `enroll()` creates the row immediately and leaves it unverified until
    // the first code is accepted. Counting it would lock somebody out of their
    // account with a secret they closed the tab on.
    expect(
      hasVerifiedFactor({
        factors: [{ status: "unverified" }]
      } as Parameters<typeof hasVerifiedFactor>[0])
    ).toBe(false);
  });

  it("counts a verified one", () => {
    expect(
      hasVerifiedFactor({
        factors: [{ status: "unverified" }, { status: "verified" }]
      } as Parameters<typeof hasVerifiedFactor>[0])
    ).toBe(true);
  });

  it("handles an account Supabase reported no factors for at all", () => {
    expect(
      hasVerifiedFactor({} as Parameters<typeof hasVerifiedFactor>[0])
    ).toBe(false);
  });
});

describe("the authorize layer refuses a session that owes a factor", () => {
  it("lets an aal2 session through", async () => {
    const context = await member({
      assuranceLevel: "aal2",
      mfaEnrolledAt: new Date()
    });

    expect(context.userId).toBe(USER);
  });

  it("refuses aal2 when the factor behind it is not trusted and 2FA is required", async () => {
    // `mfaEnrolledAt` is the TRUSTED mirror; null here means Supabase may hold
    // a verified factor, but not one this application trusts.
    expect(
      await refusalCode(
        member({
          assuranceLevel: "aal2",
          mfaEnrolledAt: null,
          twoFactorRequired: true
        })
      )
    ).toBe("mfa_enrollment_required");
  });

  it("lets an account with no factor through when no policy requires one", async () => {
    const context = await member({ assuranceLevel: "aal1" });

    expect(context.userId).toBe(USER);
  });

  it("refuses an enrolled account whose session is only aal1", async () => {
    expect(
      await refusalCode(
        member({ assuranceLevel: "aal1", mfaEnrolledAt: new Date() })
      )
    ).toBe("mfa_required");
  });

  it("refuses an unenrolled account where the organization requires a factor", async () => {
    expect(
      await refusalCode(
        member({ assuranceLevel: "aal1", twoFactorRequired: true })
      )
    ).toBe("mfa_enrollment_required");
  });

  /**
   * The two refusals carry different codes because they need different
   * screens. Telling somebody with no authenticator app to "enter the code
   * from your authenticator app" is a dead end, and collapsing them into one
   * code is how that happens.
   */
  it("distinguishes the two so the browser can route them apart", async () => {
    const challenge = await refusalCode(
      member({ assuranceLevel: "aal1", mfaEnrolledAt: new Date() })
    );
    const enroll = await refusalCode(
      member({ assuranceLevel: "aal1", twoFactorRequired: true })
    );

    expect(challenge).not.toBe(enroll);
  });

  /**
   * Without the opt-out, enrolling would be impossible in an organization that
   * mandates enrolment: the call that records the new factor would itself be
   * refused for not having one.
   */
  it("lets the enrolment route through on the named opt-out", async () => {
    const context = await member({
      assuranceLevel: "aal1",
      twoFactorRequired: true,
      allowUnsatisfiedMfa: true
    });

    expect(context.userId).toBe(USER);
  });

  it("does not let the opt-out weaken anything else about the check", async () => {
    // Same call without the flag still refuses, so the previous test is
    // measuring the flag rather than a fixture that was never going to fail.
    expect(
      await refusalCode(
        member({ assuranceLevel: "aal1", twoFactorRequired: true })
      )
    ).toBe("mfa_enrollment_required");
  });
});

/**
 * SIGN OUT AFTER INACTIVITY, AT THE LAYER THAT ENFORCES IT.
 *
 * The rule itself is covered exhaustively in inactivity-timeout.test.ts. These
 * are about the wiring: that `resolveUserActor` actually consults it, that it
 * reads THIS session's activity rather than the account's, and that the shared
 * display exemption survives the trip through the authorize layer.
 */
describe("the authorize layer refuses a session that has gone idle", () => {
  const hoursAgo = (hours: number) =>
    new Date(Date.now() - hours * 60 * 60_000);

  it("refuses a session idle past the organization's limit", async () => {
    expect(
      await refusalCode(
        member({
          assuranceLevel: "aal2",
          sessionTimeoutMinutes: 60,
          lastActiveAt: hoursAgo(3)
        })
      )
    ).toBe("session_expired");
  });

  it("lets an active session through", async () => {
    const context = await member({
      assuranceLevel: "aal2",
      sessionTimeoutMinutes: 480,
      lastActiveAt: hoursAgo(1)
    });

    expect(context.userId).toBe(USER);
  });

  /**
   * The kitchen board. Unattended is what it is FOR, and an exemption that did
   * not survive this layer would be an exemption that did not exist.
   */
  it("never refuses a shared display", async () => {
    const context = await member({
      assuranceLevel: "aal2",
      sessionTimeoutMinutes: 60,
      lastActiveAt: hoursAgo(100),
      sharedDevice: true
    });

    expect(context.userId).toBe(USER);
  });

  it("does nothing when the venue turned the timeout off", async () => {
    const context = await member({
      assuranceLevel: "aal2",
      sessionTimeoutMinutes: 0,
      lastActiveAt: hoursAgo(100)
    });

    expect(context.userId).toBe(USER);
  });

  /**
   * Every session that predates the feature has no recorded activity. If this
   * ever fails, deploying the timeout signs out every open session in every
   * organization at once.
   */
  it("does nothing for a session with no recorded activity", async () => {
    const context = await member({
      assuranceLevel: "aal2",
      sessionTimeoutMinutes: 60
    });

    expect(context.userId).toBe(USER);
  });

  /**
   * The opt-out exists so somebody can reach the screen that takes a second
   * factor. It is NOT a way to keep working on an expired session, so the
   * inactivity check is deliberately outside it.
   */
  it("still refuses an idle session on the two-factor opt-out", async () => {
    expect(
      await refusalCode(
        member({
          assuranceLevel: "aal1",
          sessionTimeoutMinutes: 60,
          lastActiveAt: hoursAgo(3),
          allowUnsatisfiedMfa: true
        })
      )
    ).toBe("session_expired");
  });
});

/**
 * THE DEVICE GATE, ON THE SIDE THAT COUNTS. The dashboard's device screen is
 * the explanation; this refusal is the control. An unconfirmed browser gets
 * no dashboard data from any route that is not explicitly exempt.
 */
describe("the authorize layer refuses an unconfirmed device", () => {
  const ORIGINAL = process.env.DEVICE_CONFIRMATION;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DEVICE_CONFIRMATION;
    else process.env.DEVICE_CONFIRMATION = ORIGINAL;
  });

  it.each<DeviceFixture>(["untrusted", "revoked", "none"])(
    "refuses a %s device with device_confirmation_required",
    async (device) => {
      expect(
        await refusalCode(member({ assuranceLevel: "aal1", device }))
      ).toBe("device_confirmation_required");
    }
  );

  it("lets a trusted device through", async () => {
    const context = await member({ assuranceLevel: "aal1", device: "trusted" });

    expect(context.userId).toBe(USER);
  });

  /**
   * TRUST EXPIRES. A device confirmed more than the trust period ago is refused
   * on the very next request - not at some later sign-in - and is confirmed
   * again like a new one.
   */
  it("refuses a device whose trust period has ended", async () => {
    expect(
      await refusalCode(member({ assuranceLevel: "aal1", device: "expired" }))
    ).toBe("device_confirmation_required");
  });

  /**
   * A row confirmed before expiry existed, with no `trustExpiresAt`, gets the
   * standard period from its confirmation - never unlimited trust.
   */
  it("expires a legacy row by its confirmation date when it has no expiry", async () => {
    mocks.resolveAuthIdentity.mockResolvedValue({
      id: "supabase-id",
      email: "user@example.com",
      assuranceLevel: "aal2",
      sessionId: "sess-1"
    });
    const row = userRow({ mfaEnrolledAt: null, twoFactorRequired: false });
    row.devices = [
      {
        confirmedAt: daysFromNow(-31),
        revokedAt: null,
        trustExpiresAt: null,
        mfaVerifiedAt: null
      }
    ];
    mocks.prisma.user.findUnique.mockResolvedValue(row);

    expect(await refusalCode(authorizeMember(undefined))).toBe(
      "device_confirmation_required"
    );
  });

  /** Password, then 2FA, then device: the factor is asked for FIRST. */
  it("asks for the second factor before the device", async () => {
    expect(
      await refusalCode(
        member({
          assuranceLevel: "aal1",
          mfaEnrolledAt: new Date(),
          device: "untrusted"
        })
      )
    ).toBe("mfa_required");
  });

  it("does not let a trusted device skip a factor it never saw entered", async () => {
    expect(
      await refusalCode(
        member({
          assuranceLevel: "aal1",
          mfaEnrolledAt: new Date(),
          device: "trusted"
        })
      )
    ).toBe("mfa_required");
  });

  it("reaches the device gate once the factor is satisfied", async () => {
    expect(
      await refusalCode(
        member({
          assuranceLevel: "aal2",
          mfaEnrolledAt: new Date(),
          device: "untrusted"
        })
      )
    ).toBe("device_confirmation_required");
  });

  it("lets the named device exemption through - and nothing else", async () => {
    const context = await member({
      assuranceLevel: "aal1",
      device: "untrusted",
      allowUnconfirmedDevice: true
    });

    expect(context.userId).toBe(USER);
    // The 2FA exemption on its own does NOT waive the device gate.
    expect(
      await refusalCode(
        member({
          assuranceLevel: "aal1",
          device: "untrusted",
          allowUnsatisfiedMfa: true
        })
      )
    ).toBe("device_confirmation_required");
  });

  it("still refuses an expired device after its factor is cleared", async () => {
    expect(
      await refusalCode(
        member({
          assuranceLevel: "aal2",
          mfaEnrolledAt: ENROLLED_EARLIER(),
          device: "expired"
        })
      )
    ).toBe("device_confirmation_required");
  });

  it("stands down only when the emergency switch is off", async () => {
    process.env.DEVICE_CONFIRMATION = "off";

    const context = await member({
      assuranceLevel: "aal1",
      device: "untrusted"
    });

    expect(context.userId).toBe(USER);
  });
});

/**
 * A TRUSTED DEVICE REMEMBERS THE AUTHENTICATOR - within limits, enforced here.
 *
 * The sign-in dialog only follows what this layer decides. Every case below is
 * a session at `aal1` - the code was NOT entered at this sign-in.
 */
describe("the authorize layer and a remembered authenticator", () => {
  it("lets a remembered trusted device through without the code", async () => {
    const context = await member({
      assuranceLevel: "aal1",
      mfaEnrolledAt: ENROLLED_EARLIER(),
      device: "remembered"
    });

    expect(context.userId).toBe(USER);
  });

  /** The decision the person made: device trust never bypasses this policy. */
  it("never skips the code where the organization requires 2FA", async () => {
    expect(
      await refusalCode(
        member({
          assuranceLevel: "aal1",
          mfaEnrolledAt: ENROLLED_EARLIER(),
          twoFactorRequired: true,
          device: "remembered"
        })
      )
    ).toBe("mfa_required");
  });

  it("never skips enrolment where the organization requires 2FA", async () => {
    // No factor at all: a trusted device is not a substitute for one.
    expect(
      await refusalCode(
        member({
          assuranceLevel: "aal1",
          mfaEnrolledAt: null,
          twoFactorRequired: true,
          device: "remembered"
        })
      )
    ).toBe("mfa_enrollment_required");
  });

  it("asks for the code again once the trust period has ended", async () => {
    expect(
      await refusalCode(
        member({
          assuranceLevel: "aal1",
          mfaEnrolledAt: daysFromNow(-60),
          device: "expired"
        })
      )
    ).toBe("mfa_required");
  });

  it("asks for the code again on a removed device", async () => {
    expect(
      await refusalCode(
        member({
          assuranceLevel: "aal1",
          mfaEnrolledAt: ENROLLED_EARLIER(),
          device: "revoked"
        })
      )
    ).toBe("mfa_required");
  });

  /** A replaced authenticator has never been entered on this device. */
  it("asks for the code when the factor is newer than the memory", async () => {
    expect(
      await refusalCode(
        member({
          assuranceLevel: "aal1",
          mfaEnrolledAt: new Date(),
          device: "remembered"
        })
      )
    ).toBe("mfa_required");
  });

  it("asks for the code on a browser with no device cookie", async () => {
    expect(
      await refusalCode(
        member({
          assuranceLevel: "aal1",
          mfaEnrolledAt: ENROLLED_EARLIER(),
          device: "none"
        })
      )
    ).toBe("mfa_required");
  });
});

describe("mfaObligation with a remembered device", () => {
  const ask = (input: {
    assuranceLevel: "aal1" | "aal2" | null;
    enrolled: boolean;
    requiredByOrganization: boolean;
    rememberedOnDevice: boolean;
  }) => mfaObligation(input);

  it("skips the code only for a factor the person chose", () => {
    expect(
      ask({
        assuranceLevel: "aal1",
        enrolled: true,
        requiredByOrganization: false,
        rememberedOnDevice: true
      })
    ).toBe("satisfied");
  });

  it("is ignored where the organization requires 2FA", () => {
    expect(
      ask({
        assuranceLevel: "aal1",
        enrolled: true,
        requiredByOrganization: true,
        rememberedOnDevice: true
      })
    ).toBe("challenge");
    expect(
      ask({
        assuranceLevel: null,
        enrolled: false,
        requiredByOrganization: true,
        rememberedOnDevice: true
      })
    ).toBe("enroll");
  });
});

describe("syncMfaEnrollment", () => {
  // A stand-in for the Prisma delegate, which declares fifteen methods this
  // function never calls. Cast rather than stubbed out in full: the two it
  // does call are the contract being tested.
  const client = () =>
    ({
      user: {
        findUnique: mocks.prisma.user.findUnique,
        update: mocks.prisma.user.update
      }
    }) as unknown as Parameters<typeof syncMfaEnrollment>[0];

  it("records a first enrolment", async () => {
    const at = new Date("2026-09-25T10:00:00.000Z");
    mocks.prisma.user.findUnique.mockResolvedValue({ mfaEnrolledAt: null });

    await syncMfaEnrollment(client(), {
      userId: USER,
      enrolled: true,
      enrolledAt: at
    });

    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER },
      data: { mfaEnrolledAt: at }
    });
  });

  /**
   * The direction that matters. A mirror still reading "enrolled" after the
   * factor is gone keeps demanding a code the account can no longer produce,
   * which locks somebody out of their own organization.
   */
  it("clears the mirror when the factor is removed", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      mfaEnrolledAt: new Date()
    });

    await syncMfaEnrollment(client(), {
      userId: USER,
      enrolled: false,
      enrolledAt: null
    });

    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER },
      data: { mfaEnrolledAt: null }
    });
  });

  it("does not rewrite the timestamp on every sync", async () => {
    // It answers "since when". This runs on every cold dashboard load, and
    // refreshing it each time would turn it into a worse copy of `last seen`.
    mocks.prisma.user.findUnique.mockResolvedValue({
      mfaEnrolledAt: new Date("2026-01-01T00:00:00.000Z")
    });

    await syncMfaEnrollment(client(), {
      userId: USER,
      enrolled: true,
      enrolledAt: new Date()
    });

    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it("writes nothing for a user row that is not there", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);

    await syncMfaEnrollment(client(), {
      userId: USER,
      enrolled: true,
      enrolledAt: new Date()
    });

    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });
});
