import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

const fileMutationSchema = z.discriminatedUnion("resource", [
  z.object({
    resource: z.literal("folder"),
    name: z.string().trim().min(1),
    parentId: z.string().uuid().nullable().optional(),
    eventId: z.string().uuid().optional()
  }),
  z.object({
    resource: z.literal("file"),
    clientId: z.string().uuid().optional(),
    folderId: z.string().uuid().optional(),
    eventId: z.string().uuid().optional(),
    bucket: z.string().trim().min(1),
    storagePath: z.string().trim().min(1),
    fileName: z.string().trim().min(1),
    contentType: z.string().trim().optional(),
    sizeBytes: z.number().int().nonnegative().optional()
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

    const [folders, files] = await Promise.all([
      prisma.fileFolder.findMany({
        where: { organizationId: actor.organizationId },
        include: { _count: { select: { files: true } } },
        orderBy: { name: "asc" }
      }),
      prisma.storedFile.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { createdAt: "desc" }
      })
    ]);
    return NextResponse.json({ folders, files });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
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

    const [event, client] = await Promise.all([
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
        : null
    ]);
    if ((input.eventId && !event) || (input.clientId && !client)) {
      return NextResponse.json(
        { error: "Event or client not found." },
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
