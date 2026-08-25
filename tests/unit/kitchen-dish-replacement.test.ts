import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    menuItem: { findFirst: vi.fn() },
    eventMenu: { findUnique: vi.fn(), updateMany: vi.fn() },
    eventMenuLine: { update: vi.fn(), findMany: vi.fn() },
    event: { update: vi.fn() },
    kitchenItemStatus: {
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
      upsert: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

import { replaceKitchenDish } from "@/features/kitchen/server/kitchen-dish-replacement";
import { prisma } from "@/lib/prisma";

/**
 * What a swap on the board has to do to count as one.
 *
 * The action this replaces wrote `Event.menuItemIds` and stopped there, so the
 * board showed a dish nothing else in the product had heard of. The line is the
 * thing that matters now, and the rest of these are the details that decide
 * whether the two views of one menu stay in step: the version guard, the mirror
 * the older readers still depend on, the frozen name a confirmed menu carries,
 * and the progress that must not travel with a dish that was never cooked.
 */

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const actorId = "22222222-2222-4222-8222-222222222222";
const menuItemId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const replacementMenuItemId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const workerId = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function replacement(styles: string[], name = "Roast chicken") {
  return {
    id: replacementMenuItemId,
    name,
    services: styles.map((serviceStyle) => ({ serviceStyle }))
  };
}

function menu({
  serviceStyle = "Buffet" as string | null,
  itemName = null as string | null,
  alsoCarriesReplacement = false
} = {}) {
  return {
    id: "menu-1",
    version: 4,
    lines: [
      { id: "line-1", menuItemId, serviceStyle, itemName },
      ...(alsoCarriesReplacement
        ? [
            {
              id: "line-2",
              menuItemId: replacementMenuItemId,
              serviceStyle: "Buffet",
              itemName: null
            }
          ]
        : [])
    ]
  };
}

function swap() {
  return replaceKitchenDish({
    actorId,
    organizationId,
    eventId,
    menuItemId,
    replacementMenuItemId
  });
}

/** What the line was actually written with. */
function lineWrite() {
  return vi.mocked(prisma.eventMenuLine.update).mock.calls[0]?.[0]?.data as
    | Record<string, unknown>
    | undefined;
}

describe("replacing a dish on the kitchen board", () => {
  let currentMenu: ReturnType<typeof menu>;

  beforeEach(() => {
    vi.clearAllMocks();
    currentMenu = menu();
    // The callback form, run against the same mocked delegates.
    vi.mocked(prisma.$transaction).mockImplementation(((
      run: (client: typeof prisma) => unknown
    ) => Promise.resolve(run(prisma))) as never);
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue(
      replacement(["Buffet"]) as never
    );
    vi.mocked(prisma.eventMenu.findUnique).mockImplementation((() =>
      Promise.resolve({
        id: currentMenu.id,
        version: currentMenu.version
      })) as never);
    vi.mocked(prisma.eventMenu.updateMany).mockResolvedValue({
      count: 1
    } as never);
    vi.mocked(prisma.eventMenuLine.update).mockResolvedValue({} as never);
    vi.mocked(prisma.eventMenuLine.findMany).mockImplementation(((args: {
      where?: object;
    }) => {
      if ("menuItemId" in ((args as { where?: object }).where ?? {})) {
        return Promise.resolve(currentMenu.lines as never);
      }

      return Promise.resolve([
        { menuItemId: replacementMenuItemId },
        { menuItemId: "other-dish" },
        // An add-on line, which carries no dish.
        { menuItemId: null }
      ] as never);
    }) as never);
    vi.mocked(prisma.event.update).mockResolvedValue({} as never);
    vi.mocked(prisma.kitchenItemStatus.findUnique).mockResolvedValue(
      null as never
    );
    vi.mocked(prisma.kitchenItemStatus.deleteMany).mockResolvedValue({
      count: 0
    } as never);
    vi.mocked(prisma.kitchenItemStatus.upsert).mockResolvedValue({} as never);
  });

  it("rewrites the line rather than the mirror alone", async () => {
    const result = await swap();

    expect(result).toEqual({
      outcome: "replaced",
      name: "Roast chicken",
      serviceStyle: "Buffet"
    });
    expect(prisma.eventMenuLine.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "line-1" } })
    );
    expect(lineWrite()).toMatchObject({ menuItemId: replacementMenuItemId });
  });

  it("keeps the style the line was already being served in", async () => {
    // A swap answers "what are we cooking", not "how does it reach the table",
    // and the style is what the quantity arithmetic runs on.
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue(
      replacement(["Buffet", "Plated"]) as never
    );
    currentMenu = menu({ serviceStyle: "Plated" });

    await swap();

    expect(lineWrite()).toMatchObject({ serviceStyle: "Plated" });
  });

  it("takes the only style the replacement has when the old one does not apply", async () => {
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue(
      replacement(["Plated"]) as never
    );

    await swap();

    expect(lineWrite()).toMatchObject({ serviceStyle: "Plated" });
  });

  it("leaves the style unanswered rather than guessing between two", async () => {
    // The guess would decide the quantity, so the sheet says "needs a service
    // style" instead - which is a state it already knows how to show.
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue(
      replacement(["Buffet", "Plated"]) as never
    );
    currentMenu = menu({ serviceStyle: null });

    const result = await swap();

    expect(lineWrite()).toMatchObject({ serviceStyle: null });
    expect(result).toMatchObject({ serviceStyle: null });
  });

  it("moves the frozen name with the dish on a confirmed menu", async () => {
    // A confirmed line answers from its own snapshot, so leaving the old name
    // there would print the dish that came off against the one that went on.
    currentMenu = menu({ itemName: "Potato kugel" });

    await swap();

    expect(lineWrite()).toMatchObject({ itemName: "Roast chicken" });
  });

  it("leaves a draft line answering from the library", async () => {
    await swap();

    expect(lineWrite()).toMatchObject({ itemName: null });
  });

  it("rebuilds the legacy mirror from the lines", async () => {
    // The PDF and the client portal still read `Event.menuItemIds`, and nothing
    // holds it to the lines - so it is rebuilt rather than patched, which also
    // heals a mirror that had already drifted.
    await swap();

    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: eventId, organizationId },
        data: expect.objectContaining({
          menuItemIds: [replacementMenuItemId, "other-dish"]
        })
      })
    );
  });

  it("keeps the cook on the dish but not the progress", async () => {
    vi.mocked(prisma.kitchenItemStatus.findUnique).mockResolvedValue({
      assignedWorkerId: workerId
    } as never);

    await swap();

    expect(prisma.kitchenItemStatus.deleteMany).toHaveBeenCalledWith({
      where: { eventId, menuItemId }
    });
    expect(
      vi.mocked(prisma.kitchenItemStatus.upsert).mock.calls[0]?.[0]
    ).toMatchObject({
      update: { status: null, assignedWorkerId: workerId },
      create: { status: null, assignedWorkerId: workerId }
    });
  });

  it("clears any status the replacement was left by an earlier swap", async () => {
    await swap();

    expect(prisma.kitchenItemStatus.upsert).not.toHaveBeenCalled();
    expect(prisma.kitchenItemStatus.deleteMany).toHaveBeenCalledWith({
      where: { eventId, menuItemId: replacementMenuItemId }
    });
  });

  it("refuses a dish this menu already carries", async () => {
    // `(menu, dish)` is unique, so the write would fail anyway - this is the
    // difference between a sentence the kitchen can act on and a 500.
    currentMenu = menu({ alsoCarriesReplacement: true });

    const result = await swap();

    expect(result).toEqual({
      outcome: "already-on-menu",
      name: "Roast chicken"
    });
    expect(prisma.eventMenuLine.update).not.toHaveBeenCalled();
    expect(prisma.eventMenu.updateMany).not.toHaveBeenCalled();
  });

  it("refuses when the menu moved on between the read and the write", async () => {
    // The same version guard the Menu tab's save uses, so a swap here and an
    // edit there cannot land on top of each other's read.
    vi.mocked(prisma.eventMenu.updateMany).mockResolvedValue({
      count: 0
    } as never);

    const result = await swap();

    expect(result).toEqual({ outcome: "conflict" });
    expect(prisma.eventMenuLine.update).not.toHaveBeenCalled();
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("refuses when the dish coming off is not on this menu", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(null as never);

    const result = await swap();

    expect(result).toEqual({ outcome: "line-not-found" });
    expect(prisma.eventMenu.updateMany).not.toHaveBeenCalled();
  });

  it("will not put a retired dish on a menu", async () => {
    // Retired dishes stay where they already are and are not offered for
    // anything new, which is the rule the library itself follows.
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue(null as never);

    const result = await swap();

    expect(result).toEqual({ outcome: "replacement-not-found" });
    expect(
      vi.mocked(prisma.menuItem.findFirst).mock.calls[0]?.[0]?.where
    ).toMatchObject({
      id: replacementMenuItemId,
      organizationId,
      isActive: true
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
