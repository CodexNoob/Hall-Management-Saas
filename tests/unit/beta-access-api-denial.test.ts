// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A pending applicant holds a perfectly valid Supabase JWT. This is what stops
 * them using it against a protected route.
 *
 * Nothing in the beta work touches the API routes, and that is the claim under
 * test: because `provisionOwner` refuses, no `users` row is ever written, and
 * `resolveUserActor` - the first thing every guarded route reaches - has
 * nothing to resolve. The refusal is therefore already in place for all of
 * them, and it cannot be forgotten on the fiftieth route somebody adds.
 *
 * The REAL `authorize()` runs here. Mocking it would test nothing.
 */

vi.mock("server-only", () => ({}));

const { findUniqueUser, findManyPrincipalRoles, findManyPrincipalPermissions } =
  vi.hoisted(() => ({
    findUniqueUser: vi.fn(),
    findManyPrincipalRoles: vi.fn(),
    findManyPrincipalPermissions: vi.fn()
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: findUniqueUser },
    principalRole: { findMany: findManyPrincipalRoles },
    principalPermission: { findMany: findManyPrincipalPermissions }
  }
}));

const { getClaims } = vi.hoisted(() => ({ getClaims: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseTokenVerifier: () => ({ auth: { getClaims } }),
  createSupabaseServerClient: async () => ({ auth: { getClaims } })
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, getAll: () => [] })
}));

import { AuthorizationError } from "@/lib/auth/errors";
import { authorize } from "@/lib/authz/authorize";
import { clearAccessCache } from "@/lib/authz/decide";

const AUTH_ID = "11111111-1111-4111-8111-111111111111";

function protectedRequest() {
  return new Request("http://localhost/api/halls", {
    headers: { Authorization: "Bearer a-perfectly-valid-token" }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  clearAccessCache();
  // Supabase is happy: the applicant confirmed their email and signed in. The
  // token verifies and the claims are real.
  getClaims.mockResolvedValue({
    data: { claims: { sub: AUTH_ID, email: "applicant@example.com" } },
    error: null
  });
  findManyPrincipalRoles.mockResolvedValue([]);
  findManyPrincipalPermissions.mockResolvedValue([]);
  // Exactly the state the gate leaves behind: a Supabase identity, and nothing
  // of ours.
  findUniqueUser.mockResolvedValue(null);
});

describe("a pending applicant calling a protected route directly", () => {
  it("is refused, because provisioning never wrote them a user row", async () => {
    await expect(
      authorize(protectedRequest(), "calendar.read")
    ).rejects.toThrow(AuthorizationError);

    await expect(
      authorize(protectedRequest(), "calendar.read")
    ).rejects.toMatchObject({ status: 403, code: "not_permitted" });
  });

  it("is refused whichever permission it asks for", async () => {
    // The point being that this is not a permission check they fail: there is
    // no principal to check anything against, so every key answers the same.
    for (const key of ["calendar.read", "event.create", "settings.update"]) {
      await expect(
        authorize(protectedRequest(), key as "calendar.read")
      ).rejects.toMatchObject({ status: 403 });
    }
  });

  it("says nothing about beta status to an unprovisioned caller", async () => {
    // Deliberate. The beta reason is told to somebody signing in, on a page
    // that can act on it; an API caller with no account here is simply not
    // provisioned, and spelling out why would confirm the address registered.
    await expect(
      authorize(protectedRequest(), "calendar.read")
    ).rejects.toMatchObject({
      message: expect.stringMatching(/not provisioned/i)
    });
  });
});
