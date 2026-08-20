import { Readable } from "node:stream";
import { google } from "googleapis";
import { createGoogleOAuthClient } from "@/lib/google/oauth";
import { getEnv } from "@/lib/env";

export type DriveStatus = {
  /** Every credential the integration needs is present. */
  configured: boolean;
  /** Which pieces are missing, so the UI can say so rather than just "off". */
  missing: string[];
};

/**
 * Whether Drive mirroring can run.
 *
 * Deliberately a check rather than a throw: the integration is optional, and a
 * venue that has not connected Drive should see it described as unconfigured,
 * not get an error on an unrelated upload.
 */
export function getDriveStatus(): DriveStatus {
  const env = getEnv();
  const required = {
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI,
    ENCRYPTION_KEY: env.ENCRYPTION_KEY,
    GOOGLE_DRIVE_ENCRYPTED_REFRESH_TOKEN:
      env.GOOGLE_DRIVE_ENCRYPTED_REFRESH_TOKEN,
    GOOGLE_DRIVE_FOLDER_ID: env.GOOGLE_DRIVE_FOLDER_ID
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return { configured: missing.length === 0, missing };
}

function createDriveClient() {
  const env = getEnv();
  const status = getDriveStatus();

  if (!status.configured) {
    throw new Error(
      `Google Drive is not configured. Missing: ${status.missing.join(", ")}.`
    );
  }

  return google.drive({
    version: "v3",
    auth: createGoogleOAuthClient(env.GOOGLE_DRIVE_ENCRYPTED_REFRESH_TOKEN!)
  });
}

/** Drive allows duplicate folder names, so a lookup has to come first. */
async function findFolder(
  drive: ReturnType<typeof createDriveClient>,
  name: string,
  parentId: string
) {
  // The name is escaped rather than interpolated raw: an apostrophe in a
  // client's name would otherwise terminate the quoted string and change the
  // query - the Drive equivalent of an injection.
  const escaped = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const response = await drive.files.list({
    q: [
      `name = '${escaped}'`,
      `'${parentId}' in parents`,
      "mimeType = 'application/vnd.google-apps.folder'",
      "trashed = false"
    ].join(" and "),
    fields: "files(id, name)",
    pageSize: 1
  });

  return response.data.files?.[0]?.id ?? null;
}

/**
 * The Drive folder for a path such as ["Event Core Files", "Cohen Wedding",
 * "Contracts"], creating any level that does not exist yet.
 *
 * Everything is created under GOOGLE_DRIVE_FOLDER_ID, so the integration can
 * only ever write inside the folder the venue nominated.
 */
export async function ensureDriveFolderPath(segments: string[]) {
  const env = getEnv();
  const drive = createDriveClient();
  let parentId = env.GOOGLE_DRIVE_FOLDER_ID!;

  for (const segment of segments) {
    const name = segment.trim();
    if (!name) continue;

    const existing = await findFolder(drive, name, parentId);
    if (existing) {
      parentId = existing;
      continue;
    }

    const created = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId]
      },
      fields: "id"
    });

    if (!created.data.id) {
      throw new Error(`Drive did not return an id for folder "${name}".`);
    }
    parentId = created.data.id;
  }

  return parentId;
}

/** Uploads one file and returns its Drive id. */
export async function uploadToDrive({
  body,
  fileName,
  contentType,
  folderPath
}: {
  body: Buffer;
  fileName: string;
  contentType: string;
  /** Folder names from the nominated root downwards. */
  folderPath: string[];
}) {
  const drive = createDriveClient();
  const parentId = await ensureDriveFolderPath(folderPath);

  const created = await drive.files.create({
    requestBody: { name: fileName, parents: [parentId] },
    media: { mimeType: contentType, body: Readable.from(body) },
    fields: "id, webViewLink"
  });

  if (!created.data.id) {
    throw new Error("Drive did not return an id for the uploaded file.");
  }

  return { id: created.data.id, webViewLink: created.data.webViewLink ?? null };
}
