import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({ SESSION_SECRET: "test-secret" })
}));

const { sendSecurityEmail } = vi.hoisted(() => ({
  sendSecurityEmail: vi.fn()
}));

// Capture the code the email would have carried, so a test can "read the inbox".
let lastEmailedCode: string | null = null;

vi.mock("@/lib/auth/security-emails", () => ({
  sendSecurityEmail,
  deviceConfirmationEmail: (input: { code: string }) => {
    lastEmailedCode = input.code;
    return { subject: "confirm", html: "" };
  },
  deviceRemovalCodeEmail: (input: { code: string }) => {
    lastEmailedCode = input.code;
    return { subject: "remove", html: "" };
  }
}));

import {
  generateDeviceSecret,
  hashDeviceSecret
} from "@/lib/auth/device-identity";
import {
  confirmDevice,
  findCurrentDevice,
  listDevices,
  recordDeviceMfaVerified,
  registerDeviceSighting,
  revokeAllDevices,
  revokeDevice,
  sendDeviceRemovalCode,
  verifyDeviceRemovalCode
} from "@/lib/auth/device-trust";
import { isDeviceTrusted } from "@/lib/auth/device-trust-policy";
import {
  DEVICE_TRUST_TTL_MS,
  isMfaRememberedOnDevice
} from "@/lib/auth/device-trust-policy";
import {
  SECURITY_CODE_MAX_ATTEMPTS,
  SECURITY_CODE_RESEND_COOLDOWN_MS,
  SECURITY_CODE_TTL_MS
} from "@/lib/auth/security-codes";
import { fakeCodeTable, fakeDeviceTable } from "./fake-security-tables";

const T0 = new Date("2026-09-26T12:00:00.000Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

let codes: ReturnType<typeof fakeCodeTable>;
let devices: ReturnType<typeof fakeDeviceTable>;
let client: never;

const sighting = (
  overrides: Partial<Parameters<typeof registerDeviceSighting>[1]> = {}
) => ({
  userId: "user-1",
  organizationId: "org-1",
  sessionId: "sess-1",
  secret: null,
  userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0",
  ipAddress: "203.0.113.9",
  city: "Manila",
  region: null,
  country: "PH",
  owner: { email: "ada@example.com", name: "Ada" },
  notify: true,
  now: T0,
  ...overrides
});

beforeEach(() => {
  vi.clearAllMocks();
  codes = fakeCodeTable();
  devices = fakeDeviceTable();
  client = {
    emailSecurityCode: codes.delegate,
    userDevice: devices.delegate
  } as never;
  sendSecurityEmail.mockResolvedValue("sent");
  lastEmailedCode = null;
});

describe("first sight of a device", () => {
  it("mints a new identity when the browser has no cookie, and records it untrusted", async () => {
    const result = await registerDeviceSighting(client, sighting());

    expect(result.newSecret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.device).toMatchObject({
      primary: true,
      confirmed: false,
      trusted: false,
      pendingConfirmation: true
    });
    expect(devices.rows).toHaveLength(1);
    // Only the hash is stored - never the secret.
    expect(devices.rows[0].deviceHash).toBe(
      hashDeviceSecret(result.newSecret as string)
    );
    expect(JSON.stringify(devices.rows)).not.toContain(
      result.newSecret as string
    );
  });

  it("emails a confirmation once, not on every page load", async () => {
    const first = await registerDeviceSighting(client, sighting());
    const secret = first.newSecret as string;

    await registerDeviceSighting(client, sighting({ secret, now: at(60_000) }));
    await registerDeviceSighting(
      client,
      sighting({ secret, now: at(120_000) })
    );

    expect(sendSecurityEmail).toHaveBeenCalledTimes(1);
    expect(sendSecurityEmail).toHaveBeenCalledWith(
      "device_confirmation",
      "ada@example.com",
      expect.anything()
    );
  });

  it("maps the same browser to the same device and issues no new identity", async () => {
    const first = await registerDeviceSighting(client, sighting());
    const again = await registerDeviceSighting(
      client,
      sighting({ secret: first.newSecret, now: at(5_000) })
    );

    expect(again.newSecret).toBeNull();
    expect(again.device.id).toBe(first.device.id);
    expect(devices.rows).toHaveLength(1);
  });

  it("keeps trust per user: one browser is a separate device for each person", async () => {
    const secret = generateDeviceSecret();

    const ada = await registerDeviceSighting(client, sighting({ secret }));
    const ben = await registerDeviceSighting(
      client,
      sighting({
        secret,
        userId: "user-2",
        owner: { email: "ben@example.com", name: "Ben" }
      })
    );

    expect(ben.device.id).not.toBe(ada.device.id);
    expect(devices.rows).toHaveLength(2);
  });

  it("sends nothing without a session to bind the code to", async () => {
    const result = await registerDeviceSighting(
      client,
      sighting({ sessionId: null })
    );

    expect(sendSecurityEmail).not.toHaveBeenCalled();
    expect(result.device.pendingConfirmation).toBe(false);
  });

  it("returns the primary device secret if confirmation setup fails", async () => {
    codes.delegate.findFirst.mockRejectedValueOnce(
      new Error("security-code table unavailable")
    );

    const result = await registerDeviceSighting(client, sighting());

    expect(result.newSecret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.device).toMatchObject({
      primary: true,
      confirmed: false,
      pendingConfirmation: false
    });
  });

  it("reports whether the browser was known before", async () => {
    const first = await registerDeviceSighting(client, sighting());
    const again = await registerDeviceSighting(
      client,
      sighting({ secret: first.newSecret, now: at(5_000) })
    );

    expect(first.device.known).toBe(false);
    expect(again.device.known).toBe(true);
  });
});

describe("when the email goes out", () => {
  /**
   * Password, then 2FA, then device. While the session still owes its second
   * factor the device is recorded but NOT emailed about - somebody holding
   * only the password never gets as far as the confirmation email.
   */
  it("waits until the second factor is satisfied", async () => {
    const first = await registerDeviceSighting(
      client,
      sighting({ notify: false })
    );

    expect(sendSecurityEmail).not.toHaveBeenCalled();
    expect(first.device.pendingConfirmation).toBe(false);

    const afterMfa = await registerDeviceSighting(
      client,
      sighting({ secret: first.newSecret, now: at(30_000) })
    );

    expect(sendSecurityEmail).toHaveBeenCalledTimes(1);
    expect(afterMfa.device.pendingConfirmation).toBe(true);
  });

  it("sends once per sign-in, however often the page reloads", async () => {
    const first = await registerDeviceSighting(client, sighting());
    const secret = first.newSecret as string;

    for (let minute = 1; minute <= 5; minute += 1) {
      const reload = await registerDeviceSighting(
        client,
        sighting({ secret, now: at(minute * 60_000) })
      );
      expect(reload.device.pendingConfirmation).toBe(true);
    }

    expect(sendSecurityEmail).toHaveBeenCalledTimes(1);
  });

  it("sends a fresh code for a new sign-in on the same unconfirmed browser", async () => {
    const first = await registerDeviceSighting(client, sighting());

    await registerDeviceSighting(
      client,
      sighting({
        secret: first.newSecret,
        sessionId: "sess-2",
        now: at(5 * 60_000)
      })
    );

    expect(sendSecurityEmail).toHaveBeenCalledTimes(2);
  });

  it("never emails about a trusted device", async () => {
    const first = await registerDeviceSighting(client, sighting());
    await confirmDevice(client, {
      userId: "user-1",
      deviceId: first.device.id,
      sessionId: "sess-1",
      code: lastEmailedCode as string,
      now: at(1_000)
    });
    sendSecurityEmail.mockClear();

    const later = await registerDeviceSighting(
      client,
      sighting({
        secret: first.newSecret,
        sessionId: "sess-9",
        now: at(60 * 60_000)
      })
    );

    expect(later.device.trusted).toBe(true);
    expect(sendSecurityEmail).not.toHaveBeenCalled();
  });
});

describe("confirming a device", () => {
  async function newDevice() {
    const result = await registerDeviceSighting(client, sighting());
    return { deviceId: result.device.id, secret: result.newSecret as string };
  }

  it("trusts the primary device when the emailed code is entered", async () => {
    const { deviceId, secret } = await newDevice();

    const result = await confirmDevice(client, {
      userId: "user-1",
      deviceId,
      sessionId: "sess-1",
      code: lastEmailedCode as string,
      now: at(30_000)
    });

    expect(result.status).toBe("verified");
    const row = await findCurrentDevice(client, "user-1", secret);
    expect(row?.trustedAt).toEqual(at(30_000));
    expect(row?.confirmedAt).toEqual(at(30_000));
    expect(row?.isPrimary).toBe(true);
  });

  it("trusts a secondary device too, without making it primary", async () => {
    const primary = await newDevice();
    await confirmDevice(client, {
      userId: "user-1",
      deviceId: primary.deviceId,
      sessionId: "sess-1",
      code: lastEmailedCode as string,
      now: at(1_000)
    });

    const secondarySecret = generateDeviceSecret();
    const secondary = await registerDeviceSighting(
      client,
      sighting({
        secret: secondarySecret,
        sessionId: "sess-2",
        now: at(2_000)
      })
    );
    const result = await confirmDevice(client, {
      userId: "user-1",
      deviceId: secondary.device.id,
      sessionId: "sess-2",
      code: lastEmailedCode as string,
      now: at(3_000)
    });

    expect(result.status).toBe("verified");
    expect(secondary.device).toMatchObject({ primary: false, trusted: false });
    // Trusted for the gate; `trustedAt` stays the primary's sign-out marker.
    expect(devices.rows[1]).toMatchObject({
      isPrimary: false,
      confirmedAt: at(3_000),
      trustExpiresAt: at(3_000 + DEVICE_TRUST_TTL_MS),
      trustedAt: null
    });

    const later = await registerDeviceSighting(
      client,
      sighting({ secret: secondarySecret, sessionId: "sess-3", now: at(4_000) })
    );
    expect(later.device).toMatchObject({ primary: false, trusted: true });
  });

  it("refuses an expired code", async () => {
    const { deviceId } = await newDevice();

    const result = await confirmDevice(client, {
      userId: "user-1",
      deviceId,
      sessionId: "sess-1",
      code: lastEmailedCode as string,
      now: at(SECURITY_CODE_TTL_MS + 1)
    });

    expect(result.status).toBe("expired");
    expect(devices.rows[0].trustedAt).toBeNull();
  });

  it("locks the code after the attempt limit", async () => {
    const { deviceId } = await newDevice();
    const wrong = lastEmailedCode === "000000" ? "111111" : "000000";
    let status = "";

    for (let index = 0; index < SECURITY_CODE_MAX_ATTEMPTS; index += 1) {
      status = (
        await confirmDevice(client, {
          userId: "user-1",
          deviceId,
          sessionId: "sess-1",
          code: wrong,
          now: at(1_000)
        })
      ).status;
    }

    expect(status).toBe("locked");
    expect(
      (
        await confirmDevice(client, {
          userId: "user-1",
          deviceId,
          sessionId: "sess-1",
          code: lastEmailedCode as string,
          now: at(2_000)
        })
      ).status
    ).toBe("locked");
  });

  it("spends the code: it cannot confirm twice", async () => {
    const { deviceId } = await newDevice();
    const code = lastEmailedCode as string;

    await confirmDevice(client, {
      userId: "user-1",
      deviceId,
      sessionId: "sess-1",
      code,
      now: at(1)
    });
    const again = await confirmDevice(client, {
      userId: "user-1",
      deviceId,
      sessionId: "sess-1",
      code,
      now: at(2)
    });

    expect(again.status).toBe("missing");
  });
});

describe("resend cooldown", () => {
  it("refuses a second email for the same device inside the cooldown", async () => {
    const { sendDeviceConfirmation } = await import("@/lib/auth/device-trust");
    const first = await registerDeviceSighting(client, sighting());
    const device = devices.rows[0] as never;

    const early = await sendDeviceConfirmation(client, {
      userId: "user-1",
      organizationId: "org-1",
      sessionId: "sess-1",
      device,
      owner: { email: "ada@example.com", name: "Ada" },
      now: at(SECURITY_CODE_RESEND_COOLDOWN_MS - 1_000)
    });
    const later = await sendDeviceConfirmation(client, {
      userId: "user-1",
      organizationId: "org-1",
      sessionId: "sess-1",
      device,
      owner: { email: "ada@example.com", name: "Ada" },
      now: at(SECURITY_CODE_RESEND_COOLDOWN_MS + 1_000)
    });

    expect(first.device.pendingConfirmation).toBe(true);
    expect(early.status).toBe("throttled");
    expect(later.status).toBe("sent");
  });
});

describe("removing a device", () => {
  it("takes its trust away, and treats the browser as new when it returns", async () => {
    const first = await registerDeviceSighting(client, sighting());
    const secret = first.newSecret as string;
    await confirmDevice(client, {
      userId: "user-1",
      deviceId: first.device.id,
      sessionId: "sess-1",
      code: lastEmailedCode as string,
      now: at(1_000)
    });

    expect(
      await revokeDevice(client, {
        userId: "user-1",
        deviceId: first.device.id
      })
    ).toBe(true);
    expect(await findCurrentDevice(client, "user-1", secret)).toBeNull();

    sendSecurityEmail.mockClear();
    const back = await registerDeviceSighting(
      client,
      sighting({ secret, now: at(10 * 60_000) })
    );

    expect(back.device.trusted).toBe(false);
    expect(sendSecurityEmail).toHaveBeenCalledTimes(1);
  });

  /** Primary decides what "sign out untrusted devices" keeps - nothing more. */
  it("removes the primary device like any other", async () => {
    const first = await registerDeviceSighting(client, sighting());
    await confirmDevice(client, {
      userId: "user-1",
      deviceId: first.device.id,
      sessionId: "sess-1",
      code: lastEmailedCode as string,
      now: at(1_000)
    });
    expect(devices.rows[0]).toMatchObject({ isPrimary: true, trustedAt: at(1_000) });

    expect(
      await revokeDevice(client, {
        userId: "user-1",
        deviceId: first.device.id,
        now: at(2_000)
      })
    ).toBe(true);
    expect(isDeviceTrusted(devices.rows[0] as never, at(3_000))).toBe(false);
    // No longer the trusted primary that "untrusted devices" would keep.
    expect(devices.rows[0].trustedAt).toBeNull();
  });

  it("cannot remove somebody else's device", async () => {
    const first = await registerDeviceSighting(client, sighting());

    expect(
      await revokeDevice(client, {
        userId: "someone-else",
        deviceId: first.device.id
      })
    ).toBe(false);
  });
});

/**
 * THE CODE THAT AUTHORIZES REMOVING ONE DEVICE. Nothing here revokes - these
 * cover the code's own life: bound, single-use, limited, withdrawn when it
 * could not be delivered.
 */
describe("device removal codes", () => {
  const owner = { email: "ada@example.com", name: "Ada" };

  async function twoDevices() {
    const laptop = await registerDeviceSighting(client, sighting());
    const phone = await registerDeviceSighting(
      client,
      sighting({ secret: generateDeviceSecret(), sessionId: "sess-2", now: at(1_000) })
    );
    sendSecurityEmail.mockClear();
    lastEmailedCode = null;

    return {
      laptop: devices.rows.find((row) => row.id === laptop.device.id) as never as {
        id: string;
        userAgent: string | null;
      },
      phoneId: phone.device.id
    };
  }

  const request = (
    device: { id: string; userAgent: string | null },
    overrides: { sessionId?: string; now?: Date } = {}
  ) =>
    sendDeviceRemovalCode(client, {
      userId: "user-1",
      organizationId: "org-1",
      sessionId: overrides.sessionId ?? "sess-1",
      device,
      owner,
      now: overrides.now ?? at(5 * 60_000)
    });

  const verify = (
    deviceId: string,
    code: string,
    overrides: { sessionId?: string; now?: Date } = {}
  ) =>
    verifyDeviceRemovalCode(client, {
      userId: "user-1",
      sessionId: overrides.sessionId ?? "sess-1",
      deviceId,
      code,
      now: overrides.now ?? at(6 * 60_000)
    });

  it("emails a code to the account and keeps only its hash", async () => {
    const { laptop } = await twoDevices();

    const sent = await request(laptop);

    expect(sent.status).toBe("sent");
    expect(sendSecurityEmail).toHaveBeenCalledWith(
      "device_removal_code",
      "ada@example.com",
      expect.anything()
    );
    const row = codes.rows.find((candidate) => candidate.purpose === "DEVICE_REMOVAL");
    expect(row).toMatchObject({ deviceId: laptop.id, sessionId: "sess-1" });
    expect(JSON.stringify(codes.rows)).not.toContain(lastEmailedCode as string);
  });

  it("accepts the right code once, and spends it", async () => {
    const { laptop } = await twoDevices();
    await request(laptop);
    const code = lastEmailedCode as string;

    expect((await verify(laptop.id, code)).status).toBe("verified");
    // Replayed: the same code again is gone.
    expect((await verify(laptop.id, code, { now: at(7 * 60_000) })).status).toBe(
      "missing"
    );
  });

  it("refuses a wrong code and counts it", async () => {
    const { laptop } = await twoDevices();
    await request(laptop);
    const wrong = lastEmailedCode === "000000" ? "111111" : "000000";

    expect(await verify(laptop.id, wrong)).toEqual({
      status: "invalid",
      attemptsLeft: SECURITY_CODE_MAX_ATTEMPTS - 1
    });
  });

  it("locks the code after the attempt limit - even the right one", async () => {
    const { laptop } = await twoDevices();
    await request(laptop);
    const right = lastEmailedCode as string;
    const wrong = right === "000000" ? "111111" : "000000";

    for (let index = 0; index < SECURITY_CODE_MAX_ATTEMPTS; index += 1) {
      await verify(laptop.id, wrong);
    }

    expect((await verify(laptop.id, right)).status).toBe("locked");
  });

  it("refuses an expired code", async () => {
    const { laptop } = await twoDevices();
    await request(laptop);

    expect(
      (
        await verify(laptop.id, lastEmailedCode as string, {
          now: at(5 * 60_000 + SECURITY_CODE_TTL_MS + 1)
        })
      ).status
    ).toBe("expired");
  });

  /** A code to remove the laptop can never remove the phone. */
  it("is bound to the one device it was issued for", async () => {
    const { laptop, phoneId } = await twoDevices();
    await request(laptop);

    expect((await verify(phoneId, lastEmailedCode as string)).status).toBe("missing");
  });

  it("is bound to the session that asked for it", async () => {
    const { laptop } = await twoDevices();
    await request(laptop);

    expect(
      (await verify(laptop.id, lastEmailedCode as string, { sessionId: "sess-other" }))
        .status
    ).toBe("missing");
  });

  /** A removal code is not a device confirmation, whatever it is typed into. */
  it("cannot confirm a device", async () => {
    const { phoneId } = await twoDevices();
    const phone = devices.rows.find((row) => row.id === phoneId) as never as {
      id: string;
      userAgent: string | null;
    };
    await request(phone, { sessionId: "sess-2" });

    const result = await confirmDevice(client, {
      userId: "user-1",
      deviceId: phoneId,
      sessionId: "sess-2",
      code: lastEmailedCode as string,
      now: at(6 * 60_000)
    });

    expect(result.status).not.toBe("verified");
  });

  it("throttles a second request inside the cooldown", async () => {
    const { laptop } = await twoDevices();
    await request(laptop);

    const again = await request(laptop, {
      now: at(5 * 60_000 + SECURITY_CODE_RESEND_COOLDOWN_MS - 1_000)
    });

    expect(again).toMatchObject({ status: "throttled", reason: "cooldown" });
    expect(sendSecurityEmail).toHaveBeenCalledTimes(1);
  });

  it("caps how many codes one person can request in an hour", async () => {
    const { laptop } = await twoDevices();
    let last;

    for (let index = 0; index < 6; index += 1) {
      last = await request(laptop, {
        now: at(5 * 60_000 + index * (SECURITY_CODE_RESEND_COOLDOWN_MS + 1_000))
      });
    }

    expect(last).toMatchObject({ status: "throttled", reason: "hourly_limit" });
  });

  it("makes an older code for the device stop working when a new one is sent", async () => {
    const { laptop } = await twoDevices();
    await request(laptop);
    const older = lastEmailedCode as string;
    await request(laptop, { now: at(5 * 60_000 + SECURITY_CODE_RESEND_COOLDOWN_MS + 1) });
    const newer = lastEmailedCode as string;

    if (older !== newer) {
      expect(
        (await verify(laptop.id, older, { now: at(7 * 60_000) })).status
      ).not.toBe("verified");
    }
    expect((await verify(laptop.id, newer, { now: at(7 * 60_000) })).status).toBe(
      "verified"
    );
  });

  it.each(["failed", "unconfigured"] as const)(
    "withdraws a code the provider %s to deliver",
    async (outcome) => {
      const { laptop } = await twoDevices();
      sendSecurityEmail.mockResolvedValueOnce(outcome);

      const sent = await request(laptop);

      expect(sent.status).toBe("undelivered");
      // Nobody holds it, and it cannot be used even by guessing it.
      expect((await verify(laptop.id, lastEmailedCode as string)).status).toBe(
        "missing"
      );
    }
  );
});

describe("removing every device", () => {
  async function confirmedDevice(secret: string, sessionId: string, now: Date) {
    const seen = await registerDeviceSighting(
      client,
      sighting({ secret, sessionId, now })
    );
    await confirmDevice(client, {
      userId: "user-1",
      deviceId: seen.device.id,
      sessionId,
      code: lastEmailedCode as string,
      mfaVerified: true,
      now
    });
  }

  it("removes all of this person's devices, the primary included", async () => {
    await confirmedDevice(generateDeviceSecret(), "sess-1", at(1_000));
    await confirmedDevice(generateDeviceSecret(), "sess-2", at(2 * 60_000));

    expect(await revokeAllDevices(client, { userId: "user-1", now: at(5 * 60_000) })).toBe(2);

    for (const row of devices.rows) {
      expect(row).toMatchObject({
        revokedAt: at(5 * 60_000),
        confirmedAt: null,
        trustedAt: null,
        trustExpiresAt: null,
        mfaVerifiedAt: null
      });
    }
    expect(devices.rows.some((row) => row.isPrimary)).toBe(true);
  });

  it("leaves other people's devices alone", async () => {
    await registerDeviceSighting(
      client,
      sighting({ userId: "user-2", owner: { email: "ben@example.com", name: "Ben" } })
    );

    await revokeAllDevices(client, { userId: "user-1" });

    expect(devices.rows[0].revokedAt).toBeNull();
  });

  /** Fresh verification: each browser is new again and gets a new code. */
  it("makes every browser verify again from scratch", async () => {
    const secret = generateDeviceSecret();
    await confirmedDevice(secret, "sess-1", at(1_000));
    await revokeAllDevices(client, { userId: "user-1", now: at(2_000) });
    sendSecurityEmail.mockClear();

    const back = await registerDeviceSighting(
      client,
      sighting({ secret, sessionId: "sess-9", now: at(3 * 60_000) })
    );

    expect(back.device).toMatchObject({
      confirmed: false,
      trusted: false,
      pendingConfirmation: true
    });
    expect(sendSecurityEmail).toHaveBeenCalledTimes(1);
  });
});

describe("trust expires", () => {
  async function trustedDevice(options: { mfaVerified?: boolean } = {}) {
    const first = await registerDeviceSighting(client, sighting());
    await confirmDevice(client, {
      userId: "user-1",
      deviceId: first.device.id,
      sessionId: "sess-1",
      code: lastEmailedCode as string,
      mfaVerified: options.mfaVerified,
      now: at(1_000)
    });
    sendSecurityEmail.mockClear();

    return { deviceId: first.device.id, secret: first.newSecret as string };
  }

  it("fixes the period from the confirmation", async () => {
    await trustedDevice();

    expect(devices.rows[0].trustExpiresAt).toEqual(at(1_000 + DEVICE_TRUST_TTL_MS));
  });

  it("is not extended by using the device", async () => {
    const { secret } = await trustedDevice();

    await registerDeviceSighting(
      client,
      sighting({ secret, sessionId: "sess-2", now: at(10 * 24 * 60 * 60_000) })
    );

    expect(devices.rows[0].trustExpiresAt).toEqual(at(1_000 + DEVICE_TRUST_TTL_MS));
  });

  it("treats the device as new once the period ends - and emails a code", async () => {
    const { secret } = await trustedDevice();

    const after = await registerDeviceSighting(
      client,
      sighting({ secret, sessionId: "sess-2", now: at(DEVICE_TRUST_TTL_MS + 2_000) })
    );

    expect(after.device).toMatchObject({
      known: true,
      confirmed: true,
      trusted: false,
      pendingConfirmation: true
    });
    expect(sendSecurityEmail).toHaveBeenCalledTimes(1);
  });

  it("starts a fresh period when the expired device is confirmed again", async () => {
    const { deviceId, secret } = await trustedDevice({ mfaVerified: true });
    const expiredAt = at(DEVICE_TRUST_TTL_MS + 2_000);

    await registerDeviceSighting(
      client,
      sighting({ secret, sessionId: "sess-2", now: expiredAt })
    );
    const result = await confirmDevice(client, {
      userId: "user-1",
      deviceId,
      sessionId: "sess-2",
      code: lastEmailedCode as string,
      // Re-confirmed without the authenticator this time.
      mfaVerified: false,
      now: expiredAt
    });

    expect(result.status).toBe("verified");
    expect(devices.rows[0]).toMatchObject({
      confirmedAt: expiredAt,
      trustExpiresAt: new Date(expiredAt.getTime() + DEVICE_TRUST_TTL_MS),
      // The new period never inherits the old period's memory.
      mfaVerifiedAt: null
    });
  });
});

describe("remembering the authenticator on a trusted device", () => {
  const enrolledAt = new Date(T0.getTime() - 24 * 60 * 60_000);

  async function confirmed(mfaVerified: boolean) {
    const first = await registerDeviceSighting(client, sighting());
    await confirmDevice(client, {
      userId: "user-1",
      deviceId: first.device.id,
      sessionId: "sess-1",
      code: lastEmailedCode as string,
      mfaVerified,
      now: at(1_000)
    });

    return first.device.id;
  }

  it("remembers it only when the code was entered in the confirming session", async () => {
    await confirmed(true);

    expect(devices.rows[0].mfaVerifiedAt).toEqual(at(1_000));
    expect(
      isMfaRememberedOnDevice({
        device: devices.rows[0] as never,
        mfaEnrolledAt: enrolledAt,
        now: at(60_000)
      })
    ).toBe(true);
  });

  it("does not remember it from the email code alone", async () => {
    await confirmed(false);

    expect(devices.rows[0].mfaVerifiedAt).toBeNull();
  });

  it("can be recorded later on a trusted device, without extending trust", async () => {
    const deviceId = await confirmed(false);

    expect(
      await recordDeviceMfaVerified(client, {
        userId: "user-1",
        deviceId,
        now: at(5 * 60_000)
      })
    ).toBe(true);
    expect(devices.rows[0]).toMatchObject({
      mfaVerifiedAt: at(5 * 60_000),
      trustExpiresAt: at(1_000 + DEVICE_TRUST_TTL_MS)
    });
  });

  it("is never recorded on an expired or removed device", async () => {
    const deviceId = await confirmed(false);

    expect(
      await recordDeviceMfaVerified(client, {
        userId: "user-1",
        deviceId,
        now: at(DEVICE_TRUST_TTL_MS + 2_000)
      })
    ).toBe(false);

    await revokeDevice(client, { userId: "user-1", deviceId, now: at(2_000) });
    expect(
      await recordDeviceMfaVerified(client, {
        userId: "user-1",
        deviceId,
        now: at(3_000)
      })
    ).toBe(false);
  });

  it("is forgotten when the device is removed", async () => {
    const deviceId = await confirmed(true);

    await revokeDevice(client, { userId: "user-1", deviceId, now: at(2_000) });

    expect(devices.rows[0]).toMatchObject({
      revokedAt: at(2_000),
      confirmedAt: null,
      trustExpiresAt: null,
      mfaVerifiedAt: null
    });
  });

  it("is not carried into a removed device that comes back", async () => {
    const first = await registerDeviceSighting(client, sighting());
    const secret = first.newSecret as string;
    await confirmDevice(client, {
      userId: "user-1",
      deviceId: first.device.id,
      sessionId: "sess-1",
      code: lastEmailedCode as string,
      mfaVerified: true,
      now: at(1_000)
    });
    await revokeDevice(client, {
      userId: "user-1",
      deviceId: first.device.id,
      now: at(2_000)
    });

    const back = await registerDeviceSighting(
      client,
      sighting({ secret, sessionId: "sess-2", now: at(3_000) })
    );

    expect(back.device).toMatchObject({ trusted: false, confirmed: false });
    expect(devices.rows[0].mfaVerifiedAt).toBeNull();
  });
});

describe("the device list", () => {
  it("shows when each trusted device must be verified again", async () => {
    const first = await registerDeviceSighting(client, sighting());
    await confirmDevice(client, {
      userId: "user-1",
      deviceId: first.device.id,
      sessionId: "sess-1",
      code: lastEmailedCode as string,
      now: at(1_000)
    });

    const list = await listDevices(client, "user-1", first.device.id, at(2_000));

    expect(list[0]).toMatchObject({
      confirmed: true,
      trusted: true,
      trustExpiresAt: at(1_000 + DEVICE_TRUST_TTL_MS)
    });

    const expired = await listDevices(
      client,
      "user-1",
      first.device.id,
      at(DEVICE_TRUST_TTL_MS + 2_000)
    );
    expect(expired[0]).toMatchObject({ confirmed: true, trusted: false });
  });

  it("never includes the device hash", async () => {
    const first = await registerDeviceSighting(client, sighting());
    const list = await listDevices(client, "user-1", first.device.id);

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      current: true,
      primary: true,
      confirmed: false,
      trusted: false
    });
    expect(JSON.stringify(list)).not.toContain(
      devices.rows[0].deviceHash as string
    );
    expect(Object.keys(list[0])).not.toContain("deviceHash");
  });
});
