import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ SESSION_SECRET: "test-secret" }) }));

import {
  ENROLLMENT_GRANT_TTL_MS,
  SECURITY_CODE_MAX_ATTEMPTS,
  SECURITY_CODE_MAX_SENDS_PER_HOUR,
  SECURITY_CODE_RESEND_COOLDOWN_MS,
  SECURITY_CODE_TTL_MS,
  consumeEnrollmentGrant,
  hashSecurityCode,
  issueSecurityCode,
  maskEmail,
  verifySecurityCode
} from "@/lib/auth/security-codes";
import { fakeCodeTable } from "./fake-security-tables";

function fakeTable() {
  const { rows, delegate } = fakeCodeTable();

  return { rows, client: { emailSecurityCode: delegate as never } };
}

const T0 = new Date("2026-09-26T12:00:00.000Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

const base = {
  userId: "user-1",
  organizationId: "org-1",
  purpose: "MFA_ENROLLMENT" as const,
  sessionId: "sess-1",
  ipAddress: null,
  userAgent: null
};

let table: ReturnType<typeof fakeTable>;

beforeEach(() => {
  table = fakeTable();
});

async function issue(now = T0) {
  const result = await issueSecurityCode(table.client, { ...base, now });
  if (result.status !== "issued") throw new Error(`not issued: ${result.status}`);
  return result;
}

describe("issuing a code", () => {
  it("stores only a hash, never the code", async () => {
    const { code, id } = await issue();
    const stored = table.rows[0];

    expect(JSON.stringify(stored)).not.toContain(code);
    expect(stored.codeHash).toBe(hashSecurityCode(id, code));
    expect(code).toMatch(/^\d{6}$/);
  });

  it("expires ten minutes after it is issued", async () => {
    const { expiresAt } = await issue();

    expect(expiresAt.getTime() - T0.getTime()).toBe(SECURITY_CODE_TTL_MS);
  });

  it("refuses a resend inside the cooldown", async () => {
    await issue();

    const again = await issueSecurityCode(table.client, {
      ...base,
      now: at(SECURITY_CODE_RESEND_COOLDOWN_MS - 1_000)
    });

    expect(again.status).toBe("cooldown");
  });

  it("caps sends per hour", async () => {
    for (let index = 0; index < SECURITY_CODE_MAX_SENDS_PER_HOUR; index += 1) {
      await issue(at(index * (SECURITY_CODE_RESEND_COOLDOWN_MS + 1_000)));
    }

    const extra = await issueSecurityCode(table.client, {
      ...base,
      now: at(SECURITY_CODE_MAX_SENDS_PER_HOUR * (SECURITY_CODE_RESEND_COOLDOWN_MS + 1_000))
    });

    expect(extra.status).toBe("hourly_limit");
  });

  it("kills the previous code when a new one is sent", async () => {
    const first = await issue();
    await issue(at(SECURITY_CODE_RESEND_COOLDOWN_MS + 1));

    const result = await verifySecurityCode(table.client, {
      ...base,
      code: first.code,
      now: at(SECURITY_CODE_RESEND_COOLDOWN_MS + 2)
    });

    // The new code is the live one; the old one does not match it.
    expect(result.status).not.toBe("verified");
  });
});

describe("verifying a code", () => {
  it("turns a correct code into a grant that lasts about fifteen minutes", async () => {
    const { code } = await issue();

    const result = await verifySecurityCode(table.client, { ...base, code, now: at(1_000) });

    expect(result).toEqual({
      status: "verified",
      grantExpiresAt: at(1_000 + ENROLLMENT_GRANT_TTL_MS)
    });
  });

  it("refuses an expired code", async () => {
    const { code } = await issue();

    const result = await verifySecurityCode(table.client, {
      ...base,
      code,
      now: at(SECURITY_CODE_TTL_MS + 1)
    });

    expect(result.status).toBe("expired");
  });

  it("counts wrong attempts and locks at the limit", async () => {
    const { code } = await issue();
    const wrong = code === "000000" ? "111111" : "000000";

    for (let index = 1; index < SECURITY_CODE_MAX_ATTEMPTS; index += 1) {
      const result = await verifySecurityCode(table.client, { ...base, code: wrong, now: at(1) });
      expect(result).toEqual({
        status: "invalid",
        attemptsLeft: SECURITY_CODE_MAX_ATTEMPTS - index
      });
    }

    expect(
      (await verifySecurityCode(table.client, { ...base, code: wrong, now: at(1) })).status
    ).toBe("locked");
    // Even the right code is refused once it is locked.
    expect(
      (await verifySecurityCode(table.client, { ...base, code, now: at(2) })).status
    ).toBe("locked");
  });

  it("only works in the session that asked for it", async () => {
    const { code } = await issue();

    const result = await verifySecurityCode(table.client, {
      ...base,
      sessionId: "someone-elses-session",
      code,
      now: at(1)
    });

    expect(result.status).toBe("missing");
  });
});

describe("the enrollment grant", () => {
  async function granted() {
    const { code } = await issue();
    await verifySecurityCode(table.client, { ...base, code, now: at(1_000) });
  }

  it("can be spent once, and only once", async () => {
    await granted();

    expect(
      await consumeEnrollmentGrant(table.client, { userId: "user-1", sessionId: "sess-1", now: at(2_000) })
    ).toBe(true);
    expect(
      await consumeEnrollmentGrant(table.client, { userId: "user-1", sessionId: "sess-1", now: at(3_000) })
    ).toBe(false);
  });

  it("is tied to the user and the session", async () => {
    await granted();

    expect(
      await consumeEnrollmentGrant(table.client, { userId: "user-2", sessionId: "sess-1", now: at(2_000) })
    ).toBe(false);
    expect(
      await consumeEnrollmentGrant(table.client, { userId: "user-1", sessionId: "sess-2", now: at(2_000) })
    ).toBe(false);
  });

  it("expires", async () => {
    await granted();

    expect(
      await consumeEnrollmentGrant(table.client, {
        userId: "user-1",
        sessionId: "sess-1",
        now: at(1_000 + ENROLLMENT_GRANT_TTL_MS + 1)
      })
    ).toBe(false);
  });

  it("does not exist before the code is verified", async () => {
    await issue();

    expect(
      await consumeEnrollmentGrant(table.client, { userId: "user-1", sessionId: "sess-1", now: at(1) })
    ).toBe(false);
  });
});

describe("device-scoped codes (DEVICE_TRUST)", () => {
  const device = (deviceId: string, now = T0) =>
    issueSecurityCode(table.client, {
      ...base,
      purpose: "DEVICE_TRUST",
      deviceId,
      now
    });

  it("never lets a code for one device confirm another", async () => {
    const laptop = await device("laptop");
    if (laptop.status !== "issued") throw new Error("not issued");

    const result = await verifySecurityCode(table.client, {
      ...base,
      purpose: "DEVICE_TRUST",
      deviceId: "phone",
      code: laptop.code,
      now: at(1)
    });

    expect(result.status).toBe("missing");
  });

  it("keeps the cooldown per device, so two new browsers each get a code", async () => {
    expect((await device("laptop")).status).toBe("issued");
    expect((await device("phone", at(1_000))).status).toBe("issued");
    expect((await device("phone", at(2_000))).status).toBe("cooldown");
  });

  it("does not cancel another device's live code", async () => {
    const laptop = await device("laptop");
    if (laptop.status !== "issued") throw new Error("not issued");
    await device("phone", at(1_000));

    const result = await verifySecurityCode(table.client, {
      ...base,
      purpose: "DEVICE_TRUST",
      deviceId: "laptop",
      code: laptop.code,
      now: at(2_000)
    });

    expect(result.status).toBe("verified");
  });
});

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("ada@example.com")).toBe("a•••@example.com");
  });
});
