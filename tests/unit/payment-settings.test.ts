import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: { paymentSetting: { findUnique: vi.fn() } }
}));

import { getOrganizationPaymentLink } from "@/lib/payments/payment-settings";
import { prisma } from "@/lib/prisma";

describe("organization payment link", () => {
  const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const originalEnv = process.env.CARDKNOX_PAYMENT_LINK;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.CARDKNOX_PAYMENT_LINK;
    } else {
      process.env.CARDKNOX_PAYMENT_LINK = originalEnv;
    }
  });

  it("reads the link for the requested organization only", async () => {
    vi.mocked(prisma.paymentSetting.findUnique).mockResolvedValue({
      paymentLink: "https://secure.example.com/venue-a"
    } as never);

    await expect(getOrganizationPaymentLink(organizationId)).resolves.toBe(
      "https://secure.example.com/venue-a"
    );
    expect(prisma.paymentSetting.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId } })
    );
  });

  it("returns null when the organization has no payment setting", async () => {
    vi.mocked(prisma.paymentSetting.findUnique).mockResolvedValue(null);

    await expect(
      getOrganizationPaymentLink(organizationId)
    ).resolves.toBeNull();
  });

  it("treats a blank stored link as unconfigured", async () => {
    vi.mocked(prisma.paymentSetting.findUnique).mockResolvedValue({
      paymentLink: "   "
    } as never);

    await expect(
      getOrganizationPaymentLink(organizationId)
    ).resolves.toBeNull();
  });

  it("never falls back to the global CARDKNOX_PAYMENT_LINK", async () => {
    // The bug this module exists to prevent: one tenant's merchant account
    // being served to every other tenant's clients.
    process.env.CARDKNOX_PAYMENT_LINK =
      "https://secure.cardknox.com/some-other-venue";
    vi.mocked(prisma.paymentSetting.findUnique).mockResolvedValue(null);

    await expect(
      getOrganizationPaymentLink(organizationId)
    ).resolves.toBeNull();
  });
});
