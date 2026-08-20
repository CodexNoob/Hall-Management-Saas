/**
 * The filing categories an event's documents go into.
 *
 * Deliberately short. Every extra folder is a decision on each upload and
 * another place to search, and the list this replaced had six of its nine
 * sitting empty. Two earlier lists were merged here:
 *
 * - "Client Files" is gone: everything filed against a booking is a client
 *   file, so nobody could tell it apart from Contracts or Menus.
 * - "Kitchen" folded into Menus, because a kitchen sheet is menu-derived and
 *   splitting them separates the approved menu from the sheet built off it.
 * - "Footage", "Pictures" and "Videos" became one media folder; nobody
 *   reliably distinguishes footage from video.
 *
 * These are folders rather than a column on StoredFile, which means no
 * migration and no backfill: events already carrying the older Invoicing or
 * Footage folders keep them and keep working.
 */
export const EVENT_FOLDER_SECTIONS = [
  "Contracts",
  "Invoices",
  "Menus",
  "Layouts",
  "Vendors",
  "Photos & Video",
  "Other"
] as const;

export type EventFolderSection = (typeof EVENT_FOLDER_SECTIONS)[number];

/** The category that needs a name typed for it. */
export const CUSTOM_SECTION: EventFolderSection = "Other";

/** Where files with no booking attached are filed. */
export const GENERAL_FOLDER_NAME = "General filing";

export const PERMANENT_FOLDER_NAME = "Event Core Files";

/**
 * The folder name for an event. Shared so a booking filed from the Files page
 * and from its own Files tab lands in one folder rather than two that differ
 * by a stray space.
 */
export function eventFolderName(clientName: string, eventType: string) {
  return `${clientName} ${eventType}`.trim().replace(/\s+/g, " ") || "Event";
}

type FolderRow = {
  id: string;
  name: string;
  parentId: string | null;
  eventId: string | null;
};

type CreateFolder = (input: {
  resource: "folder";
  name: string;
  parentId?: string;
  eventId?: string;
}) => Promise<{ folder: { id: string } }>;

/**
 * Finds - or creates - the folder a file should be filed into.
 *
 * Created on demand rather than when a booking is made: an event nobody files
 * anything against should not leave an empty set of folders behind. Only the
 * section actually being used is created, for the same reason.
 */
export async function resolveDestinationFolder({
  folders,
  createFolder,
  sectionName,
  event
}: {
  folders: FolderRow[];
  createFolder: CreateFolder;
  /** A section from the list, or a name typed under "Other". */
  sectionName: string;
  /** Absent for general filing that belongs to no booking. */
  event?: { id: string; clientName: string; eventType: string };
}) {
  const permanent = folders.find(
    (folder) => folder.parentId === null && folder.name === PERMANENT_FOLDER_NAME
  );

  const parentName = event
    ? eventFolderName(event.clientName, event.eventType)
    : GENERAL_FOLDER_NAME;

  // Match on the event id where there is one: two bookings can share a client
  // name and event type, and filing both under one folder would merge them.
  let parent = event
    ? folders.find((folder) => folder.eventId === event.id && folder.parentId === permanent?.id)
    : folders.find(
        (folder) =>
          folder.parentId === permanent?.id && folder.name === parentName
      );

  let parentId = parent?.id;
  if (!parentId) {
    const created = await createFolder({
      resource: "folder",
      name: parentName,
      parentId: permanent?.id,
      eventId: event?.id
    });
    parentId = created.folder.id;
    parent = { id: parentId, name: parentName, parentId: permanent?.id ?? null, eventId: event?.id ?? null };
  }

  const existingSection = folders.find(
    (folder) => folder.parentId === parentId && folder.name === sectionName
  );
  if (existingSection) return existingSection.id;

  const section = await createFolder({
    resource: "folder",
    name: sectionName,
    parentId,
    eventId: event?.id
  });

  return section.folder.id;
}
