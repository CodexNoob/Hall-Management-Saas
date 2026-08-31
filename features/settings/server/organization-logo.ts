import { ORGANIZATION_LOGO_BUCKET } from "@/lib/storage/buckets";
import {
  deleteStorageFiles,
  isOrgScopedStoragePath
} from "@/lib/storage/files";

/**
 * Validates a client-supplied logo path against the acting organization.
 *
 * Returns the message to answer with, or `null` when the path is acceptable.
 * The browser uploads to storage directly, so this is the only thing standing
 * between the settings document and a path pointing at another tenant's folder.
 *
 * Two messages rather than one: a wrong prefix is something an honest caller
 * can act on, while a traversal attempt is told only that the path is invalid.
 */
export function readLogoPathError(organizationId: string, logoPath: string) {
  if (!logoPath.startsWith(`${organizationId}/`)) {
    return "Logo path must begin with the active organization ID.";
  }

  if (!isOrgScopedStoragePath(organizationId, logoPath)) {
    return "Invalid logo path.";
  }

  return null;
}

/**
 * Drops the stored object for a logo the settings document no longer points at.
 *
 * Best effort on purpose, the same as `discardMenuPicture`: an orphaned object
 * costs a few kilobytes, while rethrowing would cost the user a settings save
 * that already succeeded. Call it only after the write, so a failure leaves an
 * unreferenced object rather than a profile whose logo 404s.
 */
export async function discardOrganizationLogo(
  organizationId: string,
  logoPath: string | null
) {
  if (!logoPath) return;

  try {
    await deleteStorageFiles({
      organizationId,
      bucket: ORGANIZATION_LOGO_BUCKET,
      paths: [logoPath]
    });
  } catch (error) {
    console.error("Failed to remove organization logo", error);
  }
}
