import { MENU_IMAGE_BUCKET } from "@/lib/storage/buckets";
import {
  deleteStorageFiles,
  isOrgScopedStoragePath
} from "@/lib/storage/files";

/**
 * Validates a client-supplied picture path against the acting organization.
 *
 * Returns the message to answer with, or `null` when the path is acceptable.
 * Both handlers that store a path call this, so create and update cannot end up
 * enforcing different rules on the same column.
 *
 * Two messages rather than one: a wrong prefix is something an honest caller
 * can act on, while a traversal attempt is told only that the path is invalid.
 */
export function readPicturePathError(
  organizationId: string,
  picturePath: string
) {
  if (!picturePath.startsWith(`${organizationId}/`)) {
    return "Picture path must begin with the active organization ID.";
  }

  if (!isOrgScopedStoragePath(organizationId, picturePath)) {
    return "Invalid picture path.";
  }

  return null;
}

/**
 * Drops the stored object for a picture no row points at any more.
 *
 * Best effort on purpose: an orphaned object costs a few kilobytes of storage,
 * while rethrowing here would cost the user the edit or delete that already
 * succeeded in the database. Call it only after the row is written, so a
 * failure leaves an unreferenced object rather than a card whose thumbnail 404s.
 */
export async function discardMenuPicture(
  organizationId: string,
  picturePath: string | null
) {
  if (!picturePath) return;

  try {
    await deleteStorageFiles({
      organizationId,
      bucket: MENU_IMAGE_BUCKET,
      paths: [picturePath]
    });
  } catch (error) {
    console.error("Failed to remove menu item picture", error);
  }
}
