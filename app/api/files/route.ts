import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSignedFileUrl } from "@/lib/storage/files";
import { getEnv } from "@/lib/env";

const allowedContentTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4"
]);

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const fileMutationSchema = z.discriminatedUnion("resource", [
  z.object({
    resource: z.literal("folder"),
    name: z.string().trim().min(1).max(120),
    parentId: z.string().uuid().nullable().optional(),
    eventId: z.string().uuid().optional()
  }),
  z.object({
    resource: z.literal("file"),
    clientId: z.string().uuid().optional(),
    folderId: z.string().uuid().optional(),
    eventId: z.string().uuid().optional(),
    bucket: z.string().trim().min(1).max(100),
    storagePath: z.string().trim().min(1).max(1024),
    fileName: z
      .string()
      .trim()
      .min(1)
      .max(180)
      .refine((name) => !/[\\/\u0000-\u001f]/.test(name), "Invalid file name."),
    contentType: z.string().trim().refine((type) => allowedContentTypes.has(type), "Unsupported file type."),
    sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES)
  })
]);
const folderUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1)
});
const folderDeleteSchema = z.object({ id: z.string().uuid() });
const PERMANENT_FOLDER_NAME = "Event Core Files";

export async function GET(request: Request) {
  try {
    const actor = await requirePermission(request, "canViewEventManager");

    // ?fileId= asks for a short-lived link to one file. The bucket is private,
    // so this is the only way the browser can open a document, and the signing
    // happens here rather than in the client so the service key never leaves
    // the server.
    const fileId = new URL(request.url).searchParams.get("fileId");
    if (fileId) {
      const file = await prisma.storedFile.findFirst({
        where: { id: fileId, organizationId: actor.organizationId },
        select: { bucket: true, storagePath: true, fileName: true }
      });
      if (!file) {
        return NextResponse.json({ error: "File not found." }, { status: 404 });
      }

      const url = await createSignedFileUrl({
        organizationId: actor.organizationId,
        bucket: file.bucket,
        path: file.storagePath,
        expiresInSeconds: 120
      });
      return NextResponse.json({ url, fileName: file.fileName });
    }

    const permanentFolder = await prisma.fileFolder.findFirst({
      where: {
        organizationId: actor.organizationId,
        parentId: null,
        name: PERMANENT_FOLDER_NAME
      },
      select: { id: true }
    });
    if (!permanentFolder) {
      await prisma.fileFolder.create({
        data: {
          organizationId: actor.organizationId,
          name: PERMANENT_FOLDER_NAME,
          parentId: null
        }
      });
    }

    const [folders, files, events] = await Promise.all([
      prisma.fileFolder.findMany({
        where: { organizationId: actor.organizationId },
        include: { _count: { select: { files: true } } },
        orderBy: { name: "asc" }
      }),
      prisma.storedFile.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { createdAt: "desc" }
      }),
      // Just enough to fill the Add File dialog's event picker. Served here so
      // the Files page stays a single request, and so the list can only ever
      // contain events from the caller's own organization.
      prisma.event.findMany({
        where: { organizationId: actor.organizationId },
        select: {
          id: true,
          clientName: true,
          eventDate: true,
          eventType: true
        },
        orderBy: { eventDate: "desc" },
        take: 200
      })
    ]);
    // The browser uploads straight to Supabase Storage, so it needs the bucket
    // name. Served from here rather than mirrored in a client constant: the
    // name comes from an env var, and a second copy could drift from it and
    // fail only in production.
    return NextResponse.json({
      folders,
      files,
      events,
      bucket: getEnv().SUPABASE_STORAGE_BUCKET_FILES
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, {
      scope: "file-create",
      limit: 40,
      windowMs: 60 * 1000
    });
    if (limited) return limited;

    const actor = await requirePermission(request, "canEditFiles");
    const input = fileMutationSchema.parse(await request.json());

    if (input.resource === "folder") {
      if (input.parentId) {
        const parent = await prisma.fileFolder.findFirst({
          where: { id: input.parentId, organizationId: actor.organizationId },
          select: { id: true }
        });
        if (!parent)
          return NextResponse.json(
            { error: "Parent folder not found." },
            { status: 404 }
          );
      }

      // Return the existing folder rather than failing on the
      // (organizationId, parentId, name) unique index. Folders are now created
      // on demand during an upload, so two people filing into the same new
      // folder at once would otherwise race and one would lose their upload to
      // a constraint error - with the object already written to storage.
      const existing = await prisma.fileFolder.findFirst({
        where: {
          organizationId: actor.organizationId,
          parentId: input.parentId ?? null,
          name: input.name
        }
      });
      if (existing) {
        return NextResponse.json({ folder: existing }, { status: 200 });
      }

      const folder = await prisma.fileFolder.create({
        data: {
          organizationId: actor.organizationId,
          name: input.name,
          parentId: input.parentId,
          eventId: input.eventId
        }
      });
      return NextResponse.json({ folder }, { status: 201 });
    }

    if (!input.storagePath.startsWith(`${actor.organizationId}/`)) {
      return NextResponse.json(
        { error: "File path must begin with the active organization ID." },
        { status: 400 }
      );
    }

    if (input.storagePath.includes("..") || input.storagePath.includes("\\")) {
      return NextResponse.json(
        { error: "Invalid storage path." },
        { status: 400 }
      );
    }

    const env = getEnv();
    const allowedBuckets = new Set([
      env.SUPABASE_STORAGE_BUCKET_FILES,
      env.SUPABASE_STORAGE_BUCKET_LAYOUTS,
      env.SUPABASE_STORAGE_BUCKET_PDFS
    ]);
    if (!allowedBuckets.has(input.bucket)) {
      return NextResponse.json(
        { error: "Storage bucket is not allowed." },
        { status: 400 }
      );
    }

    const [event, client, folder] = await Promise.all([
      input.eventId
        ? prisma.event.findFirst({
            where: { id: input.eventId, organizationId: actor.organizationId },
            select: { id: true, clientId: true }
          })
        : null,
      input.clientId
        ? prisma.client.findFirst({
            where: { id: input.clientId, organizationId: actor.organizationId },
            select: { id: true }
          })
        : null,
      input.folderId
        ? prisma.fileFolder.findFirst({
            where: { id: input.folderId, organizationId: actor.organizationId },
            select: { id: true }
          })
        : null
    ]);
    if (
      (input.eventId && !event) ||
      (input.clientId && !client) ||
      (input.folderId && !folder)
    ) {
      return NextResponse.json(
        { error: "Event, client, or folder not found." },
        { status: 404 }
      );
    }

    const file = await prisma.storedFile.create({
      data: {
        organizationId: actor.organizationId,
        clientId: input.clientId ?? event?.clientId,
        uploadedById: actor.id,
        folderId: input.folderId,
        eventId: input.eventId,
        bucket: input.bucket,
        storagePath: input.storagePath,
        fileName: input.fileName,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes
      }
    });
    return NextResponse.json({ file }, { status: 201 });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requirePermission(request, "canEditFiles");
    const input = folderUpdateSchema.parse(await request.json());
    const protectedFolder = await prisma.fileFolder.findFirst({
      where: {
        id: input.id,
        organizationId: actor.organizationId,
        parentId: null,
        name: PERMANENT_FOLDER_NAME
      },
      select: { id: true }
    });
    if (protectedFolder) {
      return NextResponse.json(
        { error: `${PERMANENT_FOLDER_NAME} cannot be renamed.` },
        { status: 409 }
      );
    }
    const result = await prisma.fileFolder.updateMany({
      where: { id: input.id, organizationId: actor.organizationId },
      data: { name: input.name }
    });
    if (!result.count)
      return NextResponse.json({ error: "Folder not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requirePermission(request, "canEditFiles");
    const input = folderDeleteSchema.parse(await request.json());
    const protectedFolder = await prisma.fileFolder.findFirst({
      where: {
        id: input.id,
        organizationId: actor.organizationId,
        parentId: null,
        name: PERMANENT_FOLDER_NAME
      },
      select: { id: true }
    });
    if (protectedFolder) {
      return NextResponse.json(
        { error: `${PERMANENT_FOLDER_NAME} cannot be deleted.` },
        { status: 409 }
      );
    }
    const result = await prisma.fileFolder.deleteMany({
      where: { id: input.id, organizationId: actor.organizationId }
    });
    if (!result.count)
      return NextResponse.json({ error: "Folder not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
