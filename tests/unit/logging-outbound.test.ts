import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The context module is mocked rather than exercised: what this file is about
 * is which level each outcome picks and which fields the line carries, not
 * pino's formatting. `tests/unit/logging-redaction.test.ts` owns that half, and
 * owns it in the Node environment because it has to.
 */
const log = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

vi.mock("@/lib/logging/context", () => ({ log }));

const { trackOutbound, trackedFetch } = await import("@/lib/logging/outbound");

const CALL = { vendor: "stripe" as const, operation: "checkout/sessions" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("trackOutbound", () => {
  it("logs a completed call at info, with the vendor, operation and a duration", async () => {
    const result = await trackOutbound(CALL, async () => "ok");

    expect(result).toBe("ok");
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledTimes(1);

    const [payload, message] = log.info.mock.calls[0];
    expect(message).toBe("outbound_call_completed");
    expect(payload).toMatchObject({
      vendor: "stripe",
      operation: "checkout/sessions",
      status: null,
      slow: false
    });
    expect(typeof payload.durationMs).toBe("number");
  });

  it("raises the level to warn when the partner answered with an error status", async () => {
    await trackedFetchAgainst(new Response("nope", { status: 402 }));

    expect(log.info).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn.mock.calls[0][0]).toMatchObject({ status: 402 });
    expect(log.warn.mock.calls[0][1]).toBe("outbound_call_completed");
  });

  it("stays at info for a 2xx", async () => {
    await trackedFetchAgainst(new Response("{}", { status: 200 }));

    expect(log.warn).not.toHaveBeenCalled();
    expect(log.info.mock.calls[0][0]).toMatchObject({ status: 200 });
  });

  it("logs a throw at warn and rethrows it", async () => {
    const boom = new Error("socket hang up");

    await expect(
      trackOutbound(CALL, async () => {
        throw boom;
      })
    ).rejects.toBe(boom);

    expect(log.warn).toHaveBeenCalledTimes(1);
    const [payload, message] = log.warn.mock.calls[0];
    expect(message).toBe("outbound_call_failed");
    expect(payload.err).toEqual({ name: "Error", message: "socket hang up" });
  });

  it("never puts the URL on the line", async () => {
    // The rule this protects: a partner URL carries ids in its path and, for a
    // customer-configured webhook, frequently a bearer token. `vendor` and
    // `operation` are the fields a query needs and are bounded by construction.
    const url = "https://api.stripe.com/v1/checkout/sessions?secret=leaked";
    await trackedFetchAgainst(new Response("{}", { status: 200 }), url);

    const serialised = JSON.stringify(log.info.mock.calls[0][0]);
    expect(serialised).not.toContain("stripe.com");
    expect(serialised).not.toContain("leaked");
  });
});

async function trackedFetchAgainst(response: Response, url = "https://example.test/x") {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);

  try {
    return await trackedFetch(CALL, url);
  } finally {
    vi.unstubAllGlobals();
  }
}
