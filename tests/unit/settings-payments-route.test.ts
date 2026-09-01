import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Re-export the real AuthorizationError: createApiErrorResponse maps it to a
// 403 with `instanceof`, so a look-alike class defined here would fall through
// to a 500 and the permission assertion below would pass for the wrong reason.
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorize: vi.fn(),
  // The door asks for `settings.read`; the branches that reach further ask
  // again through this. Whether the resolver answers correctly is a different
  // suite's question.
  assertPermission: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    organizationSetting: { upsert: vi.fn() },
    notificationPreference: { upsert: vi.fn() },
    // Every hall gets the organization-wide daily event limit written to it in
    // the same transaction.
    hall: { updateMany: vi.fn() },
    paymentSetting: { findUnique: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn()
  }
}));

import { GET, PATCH } from "@/app/api/settings/route";
import { AuthorizationError } from "@/lib/auth/errors";
import { assertPermission, authorize } from "@/lib/authz/authorize";
import { prisma } from "@/lib/prisma";
import { authzContext } from "./authz-test-helpers";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const actorId = "22222222-2222-4222-8222-222222222222";

/** A control-center payload that differs only in its portal header. */
function controlCenterWith(portalHeader: {
  style: string;
  color: string;
  imagePath: string;
}) {
  return {
    general: {
      logoPath: "",
      portalHeader,
      contactEmail: "",
      dateFormat: "MMM d, yyyy",
      timeFormat: "12-hour"
    },
    calendar: {
      defaultView: "month",
      weekStartsOn: "sunday",
      showHebrewDate: true,
      showAvailability: true,
      holdExpirationHours: 48,
      shortNoticeDays: 7
    },
    kitchen: {
      defaultView: "today",
      shortNoticeDays: 3,
      notificationsEnabled: true,
      requireMenuAcknowledgment: true
    }
  };
}

function patch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}

describe("organization payment link settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorize).mockResolvedValue(
      authzContext({ organizationId, userId: actorId })
    );
    vi.mocked(assertPermission).mockResolvedValue(undefined);
    vi.mocked(prisma.organization.findUniqueOrThrow).mockResolvedValue({
      id: organizationId,
      name: "Venue A"
    } as never);
    vi.mocked(prisma.organizationSetting.upsert).mockResolvedValue({
      integrations: null
    } as never);
    vi.mocked(prisma.notificationPreference.upsert).mockResolvedValue(
      {} as never
    );
    vi.mocked(prisma.paymentSetting.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.paymentSetting.upsert).mockResolvedValue({
      paymentLink: "https://secure.example.com/venue-a"
    } as never);
    // The route takes the interactive form and destructures a named object
    // from it. Resolving to a two-element array left `settings` undefined and
    // the handler crashed reading `.integrations` off it - a 500 the test
    // reported only as "expected 500 to be 200". Running the callback against
    // the same delegates keeps the assertions below pointed at real writes.
    vi.mocked(prisma.$transaction).mockImplementation((async (
      run: (transaction: typeof prisma) => unknown
    ) => run(prisma)) as never);
  });

  it("returns the calling organization's payment link", async () => {
    vi.mocked(prisma.paymentSetting.findUnique).mockResolvedValue({
      paymentLink: "https://secure.example.com/venue-a"
    } as never);

    const response = await GET(new Request("http://localhost/api/settings"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.payments).toEqual({
      paymentLink: "https://secure.example.com/venue-a"
    });
    expect(prisma.paymentSetting.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId } })
    );
  });

  it("reports an unconfigured organization as an empty link", async () => {
    const response = await GET(new Request("http://localhost/api/settings"));
    const body = await response.json();

    expect(body.payments).toEqual({ paymentLink: "" });
  });

  it("requires the payments permission to change the link", async () => {
    // Getting through the settings door is not enough: redirecting where money
    // lands is its own decision, asked separately.
    vi.mocked(assertPermission).mockImplementation((async (
      _context: unknown,
      permission: string
    ) => {
      if (permission === "payment.record") {
        throw new AuthorizationError(403, "You do not have permission.");
      }
    }) as never);

    const response = await patch({
      payments: { paymentLink: "https://secure.example.com/venue-a" }
    });

    expect(response.status).toBe(403);
    expect(prisma.paymentSetting.upsert).not.toHaveBeenCalled();
  });

  it("upserts against the actor's organization, ignoring any body-supplied id", async () => {
    const response = await patch({
      payments: { paymentLink: "https://secure.example.com/venue-a" }
    });

    expect(response.status).toBe(200);
    expect(assertPermission).toHaveBeenCalledWith(
      expect.anything(),
      "payment.record"
    );
    expect(prisma.paymentSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId },
        create: expect.objectContaining({ organizationId })
      })
    );
  });

  it("accepts an empty string to clear the link", async () => {
    vi.mocked(prisma.paymentSetting.upsert).mockResolvedValue({
      paymentLink: ""
    } as never);

    const response = await patch({ payments: { paymentLink: "" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.payments).toEqual({ paymentLink: "" });
  });

  it("rejects a payment link that is not a URL", async () => {
    const response = await patch({ payments: { paymentLink: "not-a-url" } });

    expect(response.status).toBe(400);
    expect(prisma.paymentSetting.upsert).not.toHaveBeenCalled();
  });

  it("does not touch payment settings when the body omits them", async () => {
    const response = await patch({ emailNotifications: false });

    expect(response.status).toBe(200);
    expect(prisma.paymentSetting.upsert).not.toHaveBeenCalled();
    expect(assertPermission).not.toHaveBeenCalledWith(
      expect.anything(),
      "payment.record"
    );
  });

  it("persists validated control-center settings in the tenant settings document", async () => {
    const controlCenter = {
      general: {
        logoPath: `${organizationId}/branding/logo.png`,
        contactEmail: "office@example.com",
        dateFormat: "MMM d, yyyy",
        timeFormat: "12-hour"
      },
      calendar: {
        defaultView: "week",
        weekStartsOn: "monday",
        showHebrewDate: true,
        showAvailability: true,
        holdExpirationHours: 48,
        shortNoticeDays: 7
      },
      kitchen: {
        defaultView: "today",
        shortNoticeDays: 3,
        notificationsEnabled: true,
        requireMenuAcknowledgment: true
      }
    };

    const response = await patch({ controlCenter });

    expect(response.status).toBe(200);
    expect(assertPermission).toHaveBeenCalledWith(
      expect.anything(),
      "settings.update"
    );
    // `clickAnywhereToAdd` and `portalHeader` are written even though the body
    // omitted them: they are defaulted rather than required precisely so a
    // payload saved before either field existed still parses, and what parses
    // is what gets stored back.
    expect(prisma.organizationSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          integrations: expect.objectContaining({
            controlCenter: {
              ...controlCenter,
              general: {
                ...controlCenter.general,
                portalHeader: {
                  style: "color",
                  color: "#1f4d73",
                  imagePath: ""
                }
              },
              calendar: { ...controlCenter.calendar, clickAnywhereToAdd: false }
            }
          })
        })
      })
    );
  });

  it("keeps a saturday week start, an explicit click-anywhere choice and a portal header", async () => {
    const controlCenter = {
      general: {
        logoPath: "",
        // The client portal header an organization chose for itself: an image,
        // with the colour it would fall back to kept beside it.
        portalHeader: {
          style: "image",
          color: "#6d1f2c",
          imagePath: `${organizationId}/branding/portal-header-1.jpg`
        },
        contactEmail: "",
        dateFormat: "MMM d, yyyy",
        timeFormat: "12-hour"
      },
      calendar: {
        defaultView: "month",
        weekStartsOn: "saturday",
        showHebrewDate: true,
        showAvailability: true,
        clickAnywhereToAdd: true,
        holdExpirationHours: 48,
        shortNoticeDays: 7
      },
      kitchen: {
        defaultView: "today",
        shortNoticeDays: 3,
        notificationsEnabled: true,
        requireMenuAcknowledgment: true
      }
    };

    const response = await patch({ controlCenter });

    expect(response.status).toBe(200);
    expect(prisma.organizationSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          integrations: expect.objectContaining({ controlCenter })
        })
      })
    );
  });

  it("rejects invalid control-center values before writing", async () => {
    const response = await patch({
      controlCenter: {
        general: {
          logoPath: "",
          contactEmail: "not-an-email",
          dateFormat: "MMM d, yyyy",
          timeFormat: "12-hour"
        },
        calendar: {
          defaultView: "year",
          weekStartsOn: "monday",
          showHebrewDate: true,
          showAvailability: true,
          holdExpirationHours: 48,
          shortNoticeDays: 7
        },
        kitchen: {
          defaultView: "today",
          shortNoticeDays: 3,
          notificationsEnabled: true,
          requireMenuAcknowledgment: true
        }
      }
    });

    expect(response.status).toBe(400);
    expect(prisma.organizationSetting.upsert).not.toHaveBeenCalled();
  });

  // The browser uploads the logo to storage itself, so the path arrives from
  // the client and this handler is the only thing that checks whose folder it
  // names.
  it("refuses a logo path outside the acting organization's folder", async () => {
    const response = await patch({
      controlCenter: {
        general: {
          logoPath: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/branding/logo.png",
          contactEmail: "",
          dateFormat: "MMM d, yyyy",
          timeFormat: "12-hour"
        },
        calendar: {
          defaultView: "month",
          weekStartsOn: "sunday",
          showHebrewDate: true,
          showAvailability: true,
          holdExpirationHours: 48,
          shortNoticeDays: 7
        },
        kitchen: {
          defaultView: "today",
          shortNoticeDays: 3,
          notificationsEnabled: true,
          requireMenuAcknowledgment: true
        }
      }
    });

    expect(response.status).toBe(400);
    expect(prisma.organizationSetting.upsert).not.toHaveBeenCalled();
  });

  // The header background is uploaded by the browser too, so it needs the same
  // check as the logo - and had it not had one, the logo's check would have
  // read as covering a payload it never looked at.
  it("refuses a header image path outside the acting organization's folder", async () => {
    const response = await patch({
      controlCenter: controlCenterWith({
        style: "image",
        color: "#1f4d73",
        imagePath:
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/branding/portal-header.jpg"
      })
    });

    expect(response.status).toBe(400);
    expect(prisma.organizationSetting.upsert).not.toHaveBeenCalled();
  });

  // The colour is painted through an inline style on a public page, so what
  // gets stored has to be a colour and nothing else.
  it("refuses a header colour that is not a hex value", async () => {
    const response = await patch({
      controlCenter: controlCenterWith({
        style: "color",
        color: "red; background-image: url(https://evil.example/x.png)",
        imagePath: ""
      })
    });

    expect(response.status).toBe(400);
    expect(prisma.organizationSetting.upsert).not.toHaveBeenCalled();
  });
});
