import React from "react";
import { act, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/http/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn()
}));

import {
  clearAuthenticatedQueryCache,
  invalidateAuthenticatedQuery,
  prefetchAuthenticatedQuery,
  setAuthenticatedQueryData,
  useAuthenticatedQuery
} from "@/features/dashboard/hooks/use-authenticated-query";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { cacheTestSessionForStarterRole } from "./auth-session-fixture";

type Payload = { label: string };

const URL = "/api/thing";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as unknown as Response;
}

/** Prints every part of the query result a caller makes decisions on. */
function Reader({ url = URL }: { url?: string }) {
  const query = useAuthenticatedQuery<Payload>(url);

  return (
    <dl>
      <dd data-testid="label">{query.data?.label ?? "-"}</dd>
      <dd data-testid="loading">{String(query.isLoading)}</dd>
      <dd data-testid="fetching">{String(query.isFetching)}</dd>
      <dd data-testid="error">{query.error ?? "-"}</dd>
    </dl>
  );
}

function read(testId: string) {
  return screen.getByTestId(testId).textContent;
}

/**
 * Renders and lets whatever the mount kicked off settle, so every assertion
 * below is about a state React has finished applying. A request that is still
 * deliberately unresolved stays unresolved.
 */
async function mount(ui: React.ReactElement) {
  let view: ReturnType<typeof render> | null = null;

  await act(async () => {
    view = render(ui);
  });

  return view as unknown as ReturnType<typeof render>;
}

function respondWith(body: unknown) {
  vi.mocked(authenticatedFetch).mockResolvedValue(jsonResponse(body));
}

/**
 * A request the test decides when to finish, so the state while it is in the
 * air can be asserted rather than raced past.
 */
function deferResponse() {
  let settle: (response: Response) => void = () => {};
  const pending = new Promise<Response>((resolve) => {
    settle = resolve;
  });

  vi.mocked(authenticatedFetch).mockReturnValueOnce(pending);

  return async (body: unknown) => {
    await act(async () => {
      settle(jsonResponse(body));
      await pending;
    });
  };
}

describe("authenticated query cache", () => {
  beforeEach(() => {
    window.localStorage.clear();
    cacheTestSessionForStarterRole("event-manager");
    vi.mocked(authenticatedFetch).mockReset();
    clearAuthenticatedQueryCache();
  });

  it("serves a second visit from cache, with no request and no loading state", async () => {
    respondWith({ label: "first" });

    const first = await mount(<Reader />);

    expect(read("label")).toBe("first");
    expect(authenticatedFetch).toHaveBeenCalledTimes(1);

    // Leaving the panel and coming back, which is what switching events and
    // switching back does to this hook.
    first.unmount();
    await mount(<Reader />);

    expect(read("label")).toBe("first");
    expect(read("loading")).toBe("false");
    expect(authenticatedFetch).toHaveBeenCalledTimes(1);
  });

  it("makes one request when two panels ask for the same url at once", async () => {
    respondWith({ label: "shared" });

    await mount(
      <>
        <Reader />
        <Reader />
      </>
    );

    expect(
      screen.getAllByTestId("label").map((node) => node.textContent)
    ).toEqual(["shared", "shared"]);
    expect(authenticatedFetch).toHaveBeenCalledTimes(1);
  });

  it("takes a payload a caller already holds instead of re-reading it", async () => {
    respondWith({ label: "first" });

    await mount(<Reader />);

    act(() => {
      setAuthenticatedQueryData<Payload>(URL, { label: "saved" });
    });

    expect(read("label")).toBe("saved");
    expect(authenticatedFetch).toHaveBeenCalledTimes(1);
  });

  it("lets a mutation write its response into the matching query cache", async () => {
    act(() => {
      setAuthenticatedQueryData<Payload>(URL, { label: "before save" });
    });

    await mount(<Reader />);
    vi.mocked(authenticatedFetch).mockResolvedValueOnce(
      jsonResponse({ label: "saved" })
    );

    const { result } = renderHook(() =>
      useAuthenticatedMutation<Payload, Payload>(URL, "PATCH", {
        cacheResponse: true
      })
    );

    await act(async () => {
      await result.current.mutate({ label: "saved" });
    });

    expect(read("label")).toBe("saved");
    expect(authenticatedFetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the rows on screen while an invalidation refreshes them", async () => {
    respondWith({ label: "first" });

    await mount(<Reader />);

    const finish = deferResponse();

    act(() => {
      invalidateAuthenticatedQuery(URL);
    });

    // The point of the whole exercise: a refresh is a refresh, not a return to
    // an empty panel.
    expect(read("label")).toBe("first");
    expect(read("loading")).toBe("false");
    expect(read("fetching")).toBe("true");

    await finish({ label: "second" });

    expect(read("label")).toBe("second");
    expect(read("fetching")).toBe("false");
    expect(authenticatedFetch).toHaveBeenCalledTimes(2);
  });

  it("leaves cached rows alone when a refresh fails", async () => {
    respondWith({ label: "first" });

    await mount(<Reader />);

    vi.mocked(authenticatedFetch).mockRejectedValueOnce(new Error("offline"));

    await act(async () => {
      invalidateAuthenticatedQuery(URL);
    });

    expect(read("label")).toBe("first");
    expect(read("error")).toBe("-");
  });

  it("reports the failure when there is nothing cached to fall back on", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(
      jsonResponse({ error: "Not allowed." }, 403)
    );

    await mount(<Reader />);

    expect(read("error")).toBe("Not allowed.");
    expect(read("loading")).toBe("false");
  });

  it("warms a url ahead of the panel that opens it", async () => {
    respondWith({ label: "warmed" });

    await act(async () => {
      await prefetchAuthenticatedQuery(URL);
    });

    await mount(<Reader />);

    expect(read("label")).toBe("warmed");
    expect(read("loading")).toBe("false");
    expect(authenticatedFetch).toHaveBeenCalledTimes(1);
  });

  it("does not re-request a url it already holds fresh", async () => {
    respondWith({ label: "warmed" });

    await act(async () => {
      await prefetchAuthenticatedQuery(URL);
      await prefetchAuthenticatedQuery(URL);
    });

    expect(authenticatedFetch).toHaveBeenCalledTimes(1);
  });

  // The map is bounded, so hovering a long list cannot grow it without end.
  // What must survive that pressure is anything a panel is reading right now.
  it("evicts cold urls under pressure but never one that is on screen", async () => {
    respondWith({ label: "first" });

    await mount(<Reader />);

    expect(read("label")).toBe("first");

    await act(async () => {
      for (let index = 0; index < 80; index += 1) {
        respondWith({ label: `row-${index}` });
        await prefetchAuthenticatedQuery(`/api/rows/${index}`);
      }
    });

    const callsAfterFlood = vi.mocked(authenticatedFetch).mock.calls.length;
    const callsFor = (url: string) =>
      vi
        .mocked(authenticatedFetch)
        .mock.calls.filter(([called]) => called === url).length;

    expect(read("label")).toBe("first");
    expect(callsFor(URL)).toBe(1);

    // The earliest cold entry is gone, which is the eviction actually happening
    // rather than the bound being ignored.
    respondWith({ label: "row-0-again" });

    await act(async () => {
      render(<Reader url="/api/rows/0" />);
    });

    expect(callsFor("/api/rows/0")).toBe(2);
    expect(vi.mocked(authenticatedFetch).mock.calls.length).toBe(
      callsAfterFlood + 1
    );
  });

  it("stops serving one user's data to the next", async () => {
    respondWith({ label: "first user" });

    const first = await mount(<Reader />);

    expect(read("label")).toBe("first user");
    first.unmount();

    // What logging out does.
    act(() => {
      clearAuthenticatedQueryCache();
    });

    const finish = deferResponse();

    await mount(<Reader />);

    expect(read("label")).toBe("-");
    expect(read("loading")).toBe("true");

    await finish({ label: "second user" });

    expect(read("label")).toBe("second user");
  });
});
