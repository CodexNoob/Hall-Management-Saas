import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiRequestError,
  readApiError,
  readApiErrorRequestId
} from "@/lib/http/api-request-error";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getCachedAuthSession: vi.fn()
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getSession: mocks.getSession }
  })
}));

vi.mock("@/lib/auth/client", () => ({
  getCachedAuthSession: mocks.getCachedAuthSession,
  fetchAuthSession: vi.fn()
}));

const { authenticatedFetch } = await import("@/lib/http/authenticated-fetch");

/**
 * The browser half of correlation: the id the client puts on the wire, and the
 * id it reads back off a failure. `withRoute` adopts the first and echoes the
 * second, and the two only join up if the shapes agree - which is what the
 * first assertion here pins down.
 */
beforeEach(() => {
  vi.restoreAllMocks();
  mocks.getSession.mockResolvedValue({
    data: { session: { access_token: "token" } },
    error: null
  });
  mocks.getCachedAuthSession.mockReturnValue(null);
});

function stubFetch(response: Response) {
  const fetchSpy = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

function sentHeaders(fetchSpy: ReturnType<typeof stubFetch>) {
  return fetchSpy.mock.calls[0][1].headers as Headers;
}

describe("authenticatedFetch request ids", () => {
  it("sends one, shaped so withRoute will accept it rather than mint its own", async () => {
    const fetchSpy = stubFetch(new Response(null, { status: 204 }));
    await authenticatedFetch("/api/events");

    const sent = sentHeaders(fetchSpy).get("x-request-id");

    // The same expression `withRoute` validates against. If either side moves,
    // the client's id is silently discarded and the browser starts showing a
    // reference that appears nowhere in the logs.
    expect(sent).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  it("gives each call its own", async () => {
    const fetchSpy = stubFetch(new Response(null, { status: 204 }));
    await authenticatedFetch("/api/events");
    await authenticatedFetch("/api/events");

    const first = (fetchSpy.mock.calls[0][1].headers as Headers).get(
      "x-request-id"
    );
    const second = (fetchSpy.mock.calls[1][1].headers as Headers).get(
      "x-request-id"
    );

    expect(first).not.toBe(second);
  });

  it("leaves an id the caller set alone", async () => {
    const fetchSpy = stubFetch(new Response(null, { status: 204 }));
    await authenticatedFetch("/api/events", {
      headers: { "x-request-id": "caller-supplied-id" }
    });

    expect(sentHeaders(fetchSpy).get("x-request-id")).toBe(
      "caller-supplied-id"
    );
  });

  it("still sends the organization header it sent before", async () => {
    mocks.getCachedAuthSession.mockReturnValue({
      activeOrganizationId: "org-1",
      epoch: 1
    });
    const fetchSpy = stubFetch(new Response(null, { status: 204 }));
    await authenticatedFetch("/api/events");

    expect(sentHeaders(fetchSpy).get("X-Organization-Id")).toBe("org-1");
  });
});

describe("readApiError", () => {
  it("carries the id the server echoed back", async () => {
    const response = new Response(JSON.stringify({ error: "Nope." }), {
      status: 403,
      headers: {
        "content-type": "application/json",
        "x-request-id": "server-echoed-id"
      }
    });

    const error = await readApiError(response);

    expect(error.requestId).toBe("server-echoed-id");
    expect(readApiErrorRequestId(error)).toBe("server-echoed-id");
  });

  it("degrades to an empty id rather than throwing when the header is absent", async () => {
    // A proxy error or a response from something that is not a wrapped route.
    // The message still has to reach the user.
    const response = new Response("<html>502</html>", { status: 502 });
    const error = await readApiError(response);

    expect(error.requestId).toBe("");
    expect(error.message).toBe("Request failed with status 502.");
  });

  it("keeps the field errors and details it already carried", async () => {
    const response = new Response(
      JSON.stringify({
        error: "Invalid request.",
        issues: { fieldErrors: { clientName: ["Required"] } },
        details: ["Still used by 2 events"]
      }),
      {
        status: 400,
        headers: {
          "content-type": "application/json",
          "x-request-id": "abcd1234-efgh"
        }
      }
    );

    const error = await readApiError(response);

    expect(error.fieldErrors).toEqual({ clientName: ["Required"] });
    expect(error.details).toEqual(["Still used by 2 events"]);
    expect(error.requestId).toBe("abcd1234-efgh");
  });
});

describe("readApiErrorRequestId", () => {
  it("returns nothing for a value that is not an ApiRequestError", () => {
    expect(readApiErrorRequestId(new Error("boom"))).toBe("");
    expect(readApiErrorRequestId(null)).toBe("");
    expect(readApiErrorRequestId("a string")).toBe("");
  });

  it("defaults to an empty id when one is constructed without it", () => {
    // The four-argument form is still in use at call sites that build the error
    // themselves rather than reading it off a response.
    expect(new ApiRequestError("Nope.", 403).requestId).toBe("");
  });
});
