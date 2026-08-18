import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Turns the free-text category on a dish into a real `MenuCategory` row.
 *
 * `menu_categories` existed for a long time without anything ever writing to
 * it, so it was empty everywhere while the course tabs were seven hardcoded
 * strings in the frontend. Resolving here means the table fills up as a natural
 * side effect of the form staff already use, rather than needing a separate
 * screen before the tabs work at all.
 *
 * Returns null for a blank category, which is a dish that has not been filed.
 */
export async function resolveMenuCategoryId(
  organizationId: string,
  categoryName: string | null | undefined
): Promise<string | null> {
  const name = categoryName?.trim();

  if (!name) return null;

  // Case-insensitive, because "Main" and "main" are one course. The exact
  // spelling of the row that already exists wins, so a stray capital in one
  // dish does not fork the tab.
  const existing = await prisma.menuCategory.findFirst({
    where: { organizationId, name: { equals: name, mode: "insensitive" } },
    select: { id: true }
  });

  if (existing) return existing.id;

  const lastCategory = await prisma.menuCategory.findFirst({
    where: { organizationId },
    select: { sortOrder: true },
    orderBy: { sortOrder: "desc" }
  });

  try {
    const created = await prisma.menuCategory.create({
      // A brand new course goes to the end of the tab strip. Ordering the tabs
      // deliberately is a separate action, not a side effect of naming a dish.
      data: {
        organizationId,
        name,
        sortOrder: (lastCategory?.sortOrder ?? -1) + 1
      },
      select: { id: true }
    });

    return created.id;
  } catch (error) {
    // Two dishes filed under a brand new course at the same moment. The unique
    // on (organization, name) caught the loser, and the winner's row is the
    // answer both of them wanted.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await prisma.menuCategory.findFirst({
        where: { organizationId, name: { equals: name, mode: "insensitive" } },
        select: { id: true }
      });

      if (raced) return raced.id;
    }

    throw error;
  }
}
