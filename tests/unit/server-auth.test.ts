import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseTokenVerifier: vi.fn(),
  createSupabaseServerClient: vi.fn()
}));

/**
 * Stands in for the request-scoped cookie jar. `requestCookies` is what a given
 * test says the browser sent.
 */
let requestCookies: Record<string, string> = {};

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name in requestCookies ? { name, value: requestCookies[name] } : undefined,
    getAll: () =>
      Object.entries(requestCookies).map(([name, value]) => ({ name, value }))
  })
}));

import {
  AuthorizationError,
  requireAuthenticatedUser,
  requirePermission
} from "@/lib/auth/server-auth";
import { prisma } from "@/lib/prisma";
import {
  createSupabaseServerClient,
  createSupabaseTokenVerifier
} from "@/lib/supabase/server";
import { ACTIVE_ORGANIZATION_COOKIE } from "@/lib/supabase/cookie-policy";

const AUTH_COOKIE = "sb-testproject-auth-token";

const getClaims = vi.fn();
const getCookieClaims = vi.fn();
const organization = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Test Organization",
  slug: "test-organization",
  isActive: true
};
const activeUser = {
  id: "22222222-2222-4222-8222-222222222222",
  organizationId: organization.id,
  name: "Test User",
  email: "user@example.com",
  role: "user",
  isActive: true,
  memberships: [
    {
      organizationId: organization.id,
      role: "member",
      isActive: true,
      organization
    }
  ],
  access: [
    {
      organizationId: organization.id,
      canCreateBooking: true,
      allowedHallIds: []
    }
  ]
};

function authenticatedRequest() {
  return new Request("http://localhost/api/events", {
    headers: { Authorization: "Bearer valid-token" }
  });
}

const validClaims = {
  data: {
    claims: {
      sub: "11111111-1111-4111-8111-111111111111",
      email: activeUser.email
    }
  },
  error: null
};

describe("server authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestCookies = {};
    vi.mocked(createSupabaseTokenVerifier).mockReturnValue({
      auth: { getClaims }
    } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { getClaims: getCookieClaims }
    } as never);
    getClaims.mockResolvedValue(validClaims);
    getCookieClaims.mockResolvedValue(validClaims);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser as never);
  });

  it("rejects a request carrying neither a bearer token nor a session cookie", async () => {
    await expect(
      requireAuthenticatedUser(new Request("http://localhost/api/events"))
    ).rejects.toMatchObject({
      status: 401,
      message: "Authentication required."
    });
    expect(createSupabaseTokenVerifier).not.toHaveBeenCalled();
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("rejects invalid Supabase sessions", async () => {
    getClaims.mockResolvedValue({
      data: null,
      error: new Error("invalid")
    });

    await expect(
      requireAuthenticatedUser(authenticatedRequest())
    ).rejects.toMatchObject({
      status: 401,
      message: "Invalid or expired session."
    });
  });

  /**
   * Server Components have no Request to hand in - this is the whole reason
   * `request` became optional.
   */
  it("authenticates from the session cookie with no request at all", async () => {
    requestCookies = { [AUTH_COOKIE]: "cookie-session" };

    await expect(requireAuthenticatedUser()).resolves.toMatchObject({
      id: activeUser.id
    });
    expect(getCookieClaims).toHaveBeenCalled();
    expect(getClaims).not.toHaveBeenCalled();
  });

  /**
   * The two 401s must stay distinguishable: a present-but-dead cookie is an
   * expired session, not a missing credential, and all the protected routes
   * surface these strings verbatim.
   */
  it("separates a dead session cookie from no credential at all", async () => {
    requestCookies = { [AUTH_COOKIE]: "expired" };
    getCookieClaims.mockResolvedValue({
      data: null,
      error: new Error("expired")
    });

    await expect(requireAuthenticatedUser()).rejects.toMatchObject({
      status: 401,
      message: "Invalid or expired session."
    });
  });

  it("prefers an explicit bearer token over the ambient cookie", async () => {
    requestCookies = { [AUTH_COOKIE]: "cookie-session" };

    await requireAuthenticatedUser(authenticatedRequest());

    expect(getClaims).toHaveBeenCalledWith("valid-token");
    expect(getCookieClaims).not.toHaveBeenCalled();
  });

  it("rejects inactive database users", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...activeUser,
      isActive: false
    } as never);

    await expect(
      requireAuthenticatedUser(authenticatedRequest())
    ).rejects.toMatchObject({ status: 403 });
  });

  it("enforces database-backed permissions", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...activeUser,
      access: [
        {
          organizationId: organization.id,
          canCreateBooking: false,
          allowedHallIds: []
        }
      ]
    } as never);

    await expect(
      requirePermission(authenticatedRequest(), "canCreateBooking")
    ).rejects.toEqual(
      new AuthorizationError(
        403,
        "You do not have permission to perform this action."
      )
    );
  });

  it("returns an authorized user with the required permission", async () => {
    await expect(
      requirePermission(authenticatedRequest(), "canCreateBooking")
    ).resolves.toMatchObject({
      id: activeUser.id
    });
  });

  it("allows members to view office pages but rejects office edits", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...activeUser,
      access: [
        {
          organizationId: organization.id,
          canViewSettings: true,
          canEditSettings: false,
          allowedHallIds: []
        }
      ]
    } as never);

    await expect(
      requirePermission(authenticatedRequest(), "canViewSettings")
    ).resolves.toMatchObject({ id: activeUser.id });
    await expect(
      requirePermission(authenticatedRequest(), "canEditSettings")
    ).rejects.toMatchObject({ status: 403 });
  });

  it("allows organization owners without an individual permission flag", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...activeUser,
      memberships: [
        {
          organizationId: organization.id,
          role: "owner",
          isActive: true,
          organization
        }
      ],
      access: []
    } as never);

    await expect(
      requirePermission(authenticatedRequest(), "canManagePayments")
    ).resolves.toMatchObject({
      organizationId: organization.id
    });
  });

  it("normalizes legacy super-admin membership roles", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...activeUser,
      memberships: [
        {
          organizationId: organization.id,
          role: "Super Admin",
          isActive: true,
          organization
        }
      ],
      access: []
    } as never);

    await expect(
      requirePermission(authenticatedRequest(), "canViewPaymentInfo")
    ).resolves.toMatchObject({ organizationId: organization.id });
  });

  it("rejects a requested organization the user has not joined", async () => {
    const request = new Request("http://localhost/api/events", {
      headers: {
        Authorization: "Bearer valid-token",
        "X-Organization-Id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
      }
    });

    await expect(requireAuthenticatedUser(request)).rejects.toMatchObject({
      status: 403
    });
  });

  describe("organization scoping", () => {
    const otherOrganization = {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      name: "Other Organization",
      slug: "other-organization",
      isActive: true
    };
    const strangerOrganizationId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const multiOrgUser = {
      ...activeUser,
      memberships: [
        ...activeUser.memberships,
        {
          organizationId: otherOrganization.id,
          role: "member",
          isActive: true,
          organization: otherOrganization
        }
      ],
      access: [
        ...activeUser.access,
        {
          organizationId: otherOrganization.id,
          canCreateBooking: true,
          allowedHallIds: []
        }
      ]
    };

    function requestWithOrganization(organizationId: string) {
      return new Request("http://localhost/api/events", {
        headers: {
          Authorization: "Bearer valid-token",
          "X-Organization-Id": organizationId
        }
      });
    }

    beforeEach(() => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(multiOrgUser as never);
    });

    it("scopes to the organization named by the cookie", async () => {
      requestCookies = {
        [AUTH_COOKIE]: "cookie-session",
        [ACTIVE_ORGANIZATION_COOKIE]: otherOrganization.id
      };

      await expect(requireAuthenticatedUser()).resolves.toMatchObject({
        organizationId: otherOrganization.id
      });
    });

    /**
     * The asymmetry that matters. An explicit header is a specific request, so
     * naming an organization you are not in is an error. The cookie is ambient
     * and goes stale the instant an administrator revokes a membership -
     * 403-ing every request with no way for the user to clear it would lock
     * them out of the whole app.
     */
    it("degrades a stale cookie to the default instead of locking the user out", async () => {
      requestCookies = {
        [AUTH_COOKIE]: "cookie-session",
        [ACTIVE_ORGANIZATION_COOKIE]: strangerOrganizationId
      };

      await expect(requireAuthenticatedUser()).resolves.toMatchObject({
        organizationId: organization.id
      });
    });

    it("still rejects that same organization when it is named by the header", async () => {
      await expect(
        requireAuthenticatedUser(requestWithOrganization(strangerOrganizationId))
      ).rejects.toMatchObject({ status: 403 });
    });

    it("lets an explicit header win over the cookie", async () => {
      requestCookies = {
        [ACTIVE_ORGANIZATION_COOKIE]: otherOrganization.id
      };

      await expect(
        requireAuthenticatedUser(requestWithOrganization(organization.id))
      ).resolves.toMatchObject({ organizationId: organization.id });
    });

    /**
     * A Server Component and an API route on the same page must not disagree
     * about which organization they are looking at.
     */
    it("resolves the same organization with or without a request", async () => {
      requestCookies = {
        [AUTH_COOKIE]: "cookie-session",
        [ACTIVE_ORGANIZATION_COOKIE]: otherOrganization.id
      };

      const fromServerComponent = await requireAuthenticatedUser();
      const fromApiRoute = await requireAuthenticatedUser(
        requestWithOrganization(otherOrganization.id)
      );

      expect(fromServerComponent.organizationId).toBe(
        fromApiRoute.organizationId
      );
    });
  });
});
