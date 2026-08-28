import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorize: vi.fn()
}));
// The route reaches no table itself, but `authorize` imports the client, and
// constructing one at import time needs a DATABASE_URL this suite has no use
// for.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/features/settings/server/organization-reset", () => ({
  resetOrganization: vi.fn(async () => ({
    scope: "events",
    deleted: { events: 3 }
  }))
}));

import { POST } from "@/app/api/settings/reset/route";
import { resetOrganization } from "@/features/settings/server/organization-reset";
import { authorize } from "@/lib/authz/authorize";
import { authzContext } from "./authz-test-helpers";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const request = (body: unknown) =>
  new Request("http://localhost/api/settings/reset", {
    method: "POST",
    body: JSON.stringify(body)
  });

describe("POST /api/settings/reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorize).mockResolvedValue(
      authzContext({ organizationId, userId })
    );
  });

  // Not `settings.update`: editing a preference is reversible by editing it
  // back, and this is the one act in the catalog with nothing to undo it.
  it("asks for the reset permission rather than the settings one", async () => {
    await POST(request({ scope: "events", confirmation: "DELETE EVENTS" }));

    expect(authorize).toHaveBeenCalledWith(
      expect.any(Request),
      "organization.reset"
    );
  });

  it("runs the named scope once the phrase matches", async () => {
    const response = await POST(
      request({ scope: "events", confirmation: "DELETE EVENTS" })
    );

    expect(response.status).toBe(200);
    expect(resetOrganization).toHaveBeenCalledWith({
      organizationId,
      actorUserId: userId,
      scope: "events"
    });
  });

  it("refuses a phrase that belongs to a different scope", async () => {
    const response = await POST(
      // The words for the event reset, sent against the account-wide one: the
      // exact confusion per-scope phrases exist to catch.
      request({ scope: "full-account", confirmation: "DELETE EVENTS" })
    );

    expect(response.status).toBe(400);
    expect(resetOrganization).not.toHaveBeenCalled();
  });

  it("refuses an unknown scope", async () => {
    const response = await POST(
      request({ scope: "everything", confirmation: "RESET ACCOUNT" })
    );

    expect(response.status).toBe(400);
    expect(resetOrganization).not.toHaveBeenCalled();
  });

  it("ignores surrounding whitespace in the typed phrase", async () => {
    const response = await POST(
      request({ scope: "settings", confirmation: "  RESET SETTINGS " })
    );

    expect(response.status).toBe(200);
    expect(resetOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "settings" })
    );
  });
});
