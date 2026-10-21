import { describe, expect, it } from "vitest";

import { resolveDashboardGate } from "@/lib/auth/dashboard-gate";

type Session = Parameters<typeof resolveDashboardGate>[0];

const session = (input: {
  obligation?: "satisfied" | "challenge" | "enroll";
  device?: { trusted: boolean; confirmationRequired: boolean } | null;
}): Session => ({
  mfa: {
    enrolled: input.obligation !== undefined && input.obligation !== "enroll",
    requiredByOrganization: false,
    obligation: input.obligation ?? "satisfied"
  },
  ...(input.device === null
    ? {}
    : {
        device: {
          known: true,
          pendingConfirmation: false,
          ...(input.device ?? { trusted: true, confirmationRequired: false })
        }
      })
});

const UNTRUSTED = { trusted: false, confirmationRequired: true };
const TRUSTED = { trusted: true, confirmationRequired: false };

describe("resolveDashboardGate - password, then 2FA, then device", () => {
  it("shows an unknown device the device gate, not the dashboard", () => {
    expect(resolveDashboardGate(session({ device: UNTRUSTED }))).toBe("device");
  });

  it("lets a confirmed device through to the dashboard", () => {
    expect(resolveDashboardGate(session({ device: TRUSTED }))).toBe("dashboard");
  });

  it("asks for 2FA BEFORE the device, when both are owed", () => {
    expect(resolveDashboardGate(session({ obligation: "challenge", device: UNTRUSTED }))).toBe(
      "mfa"
    );
    expect(resolveDashboardGate(session({ obligation: "enroll", device: UNTRUSTED }))).toBe("mfa");
  });

  it("shows the device gate once 2FA is satisfied", () => {
    expect(resolveDashboardGate(session({ obligation: "satisfied", device: UNTRUSTED }))).toBe(
      "device"
    );
  });

  it("does not let a trusted device skip 2FA", () => {
    expect(resolveDashboardGate(session({ obligation: "challenge", device: TRUSTED }))).toBe("mfa");
  });

  it("treats an older session payload with no device block as not gated here", () => {
    // The server still refuses an unconfirmed device's data on its own; this
    // only decides what to render for a payload cached before the field existed.
    expect(resolveDashboardGate(session({ device: null }))).toBe("dashboard");
  });
});
