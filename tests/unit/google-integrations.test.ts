import { beforeEach, describe, expect, it, vi } from "vitest";

const googleMocks = vi.hoisted(() => ({
  calendarInsert: vi.fn(),
  calendarUpdate: vi.fn(),
  gmailSend: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getEnv: vi.fn() }));
vi.mock("@/lib/google/oauth", () => ({
  createGoogleOAuthClient: vi.fn(() => ({ credentials: "test" }))
}));
vi.mock("googleapis", () => ({
  google: {
    calendar: vi.fn(() => ({
      events: {
        insert: googleMocks.calendarInsert,
        update: googleMocks.calendarUpdate
      }
    })),
    gmail: vi.fn(() => ({
      users: { messages: { send: googleMocks.gmailSend } }
    }))
  }
}));

import { getEnv } from "@/lib/env";
import { upsertGoogleCalendarEvent } from "@/lib/google/calendar";
import { sendGmailMessage } from "@/lib/google/gmail";

const baseEnv = {
  ENABLE_GOOGLE_CALENDAR_SYNC: true,
  ENABLE_GMAIL_PAYMENT_EMAILS: true,
  GOOGLE_CALENDAR_ID: "calendar@example.com",
  GOOGLE_CALENDAR_ENCRYPTED_REFRESH_TOKEN: "calendar-token",
  GMAIL_SENDER_EMAIL: "billing@example.com",
  GMAIL_ENCRYPTED_REFRESH_TOKEN: "gmail-token",
  GMAIL_ALLOWED_SENDER_DOMAIN: "example.com"
};

describe("Google integration failure handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEnv).mockReturnValue(baseEnv as never);
  });

  it("skips Calendar and Gmail when their feature flags are disabled", async () => {
    vi.mocked(getEnv).mockReturnValue({
      ...baseEnv,
      ENABLE_GOOGLE_CALENDAR_SYNC: false,
      ENABLE_GMAIL_PAYMENT_EMAILS: false
    } as never);

    await expect(
      upsertGoogleCalendarEvent({
        title: "Test",
        startsAt: new Date("2026-08-20T18:00:00Z"),
        endsAt: new Date("2026-08-20T22:00:00Z")
      })
    ).resolves.toEqual({ skipped: true });
    await expect(
      sendGmailMessage({
        to: "client@example.com",
        subject: "Invoice",
        html: "<p>Invoice</p>"
      })
    ).resolves.toEqual({ skipped: true });
  });

  it("reports missing Calendar and Gmail configuration", async () => {
    vi.mocked(getEnv).mockReturnValue({
      ...baseEnv,
      GOOGLE_CALENDAR_ID: undefined,
      GMAIL_SENDER_EMAIL: undefined
    } as never);

    await expect(
      upsertGoogleCalendarEvent({
        title: "Test",
        startsAt: new Date("2026-08-20T18:00:00Z"),
        endsAt: new Date("2026-08-20T22:00:00Z")
      })
    ).rejects.toThrow("Google Calendar integration is not configured.");
    await expect(
      sendGmailMessage({
        to: "client@example.com",
        subject: "Invoice",
        html: "<p>Invoice</p>"
      })
    ).rejects.toThrow("Gmail integration is not configured.");
  });

  it("propagates provider failures without reporting a successful sync", async () => {
    googleMocks.calendarInsert.mockRejectedValue(
      new Error("Calendar unavailable")
    );
    googleMocks.gmailSend.mockRejectedValue(new Error("Gmail unavailable"));

    await expect(
      upsertGoogleCalendarEvent({
        title: "Test",
        startsAt: new Date("2026-08-20T18:00:00Z"),
        endsAt: new Date("2026-08-20T22:00:00Z")
      })
    ).rejects.toThrow("Calendar unavailable");
    await expect(
      sendGmailMessage({
        to: "client@example.com",
        subject: "Invoice",
        html: "<p>Invoice</p>"
      })
    ).rejects.toThrow("Gmail unavailable");
  });

  it("rejects a Gmail sender outside the allowed domain", async () => {
    vi.mocked(getEnv).mockReturnValue({
      ...baseEnv,
      GMAIL_SENDER_EMAIL: "billing@other.example"
    } as never);

    await expect(
      sendGmailMessage({
        to: "client@example.com",
        subject: "Invoice",
        html: "<p>Invoice</p>"
      })
    ).rejects.toThrow("outside the allowed domain");
    expect(googleMocks.gmailSend).not.toHaveBeenCalled();
  });
});
