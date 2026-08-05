import { Prisma } from "@prisma/client";

type ActivityLogCreateInput = {
  organizationId: string;
  eventId?: string | null;
  clientId?: string | null;
  userId?: string | null;
  userName?: string | null;
  actionType: string;
  message: string;
  oldValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
};

type ActivityLogClient = {
  activityLog: {
    create: (args: { data: ActivityLogCreateInput }) => Promise<unknown>;
  };
};

export async function createActivityLog(
  prismaClient: unknown,
  input: ActivityLogCreateInput
) {
  const activityLogClient = prismaClient as ActivityLogClient;

  return activityLogClient.activityLog.create({
    data: {
      organizationId: input.organizationId,
      eventId: input.eventId ?? undefined,
      clientId: input.clientId ?? undefined,
      userId: input.userId ?? undefined,
      userName: input.userName ?? undefined,
      actionType: input.actionType,
      message: input.message,
      oldValue: input.oldValue ?? undefined,
      newValue: input.newValue ?? undefined
    }
  });
}
