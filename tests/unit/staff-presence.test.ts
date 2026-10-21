import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { classifyPresence } from "@/features/administration/server/staff-presence";

const now = new Date("2026-09-26T12:00:00.000Z");
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60_000);

describe("classifyPresence", () => {
  it("is online when the tab is beating and somebody touched it recently", () => {
    expect(
      classifyPresence({ lastSeenAt: minutesAgo(1), lastActiveAt: minutesAgo(4) }, now)
    ).toBe("online");
  });

  it("is away when the tab is open but nobody has touched it", () => {
    expect(
      classifyPresence({ lastSeenAt: minutesAgo(1), lastActiveAt: minutesAgo(25) }, now)
    ).toBe("away");
  });

  it("is offline once the heartbeat stops, however recent the activity", () => {
    expect(
      classifyPresence({ lastSeenAt: minutesAgo(5), lastActiveAt: minutesAgo(5) }, now)
    ).toBe("offline");
  });

  it("survives one slow beat without flickering to offline", () => {
    expect(
      classifyPresence({ lastSeenAt: minutesAgo(2.5), lastActiveAt: null }, now)
    ).toBe("online");
  });

  it("reads a session with no recorded activity as online, like the timeout does", () => {
    expect(
      classifyPresence({ lastSeenAt: minutesAgo(1), lastActiveAt: null }, now)
    ).toBe("online");
  });

  it("is offline with no session at all", () => {
    expect(
      classifyPresence({ lastSeenAt: null, lastActiveAt: null }, now)
    ).toBe("offline");
  });
});
