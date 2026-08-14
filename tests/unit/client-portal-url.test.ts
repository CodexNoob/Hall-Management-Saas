import { afterEach, describe, expect, it } from "vitest";

import { getClientPortalUrl } from "@/lib/ui/client-portal-url";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

describe("getClientPortalUrl", () => {
  afterEach(() => {
    if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("uses the browser origin during local development", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://event-core.example/";

    expect(getClientPortalUrl("event-id", "http://localhost:3000")).toBe(
      "http://localhost:3000/client/event-id"
    );
  });

  it("prefers the configured public URL on a deployed site", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://event-core.example/";

    expect(getClientPortalUrl("event-id", "https://preview.example")).toBe(
      "https://event-core.example/client/event-id"
    );
  });

  it("falls back to the current browser origin", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(getClientPortalUrl("event-id", "http://localhost:3000")).toBe(
      "http://localhost:3000/client/event-id"
    );
  });
});
