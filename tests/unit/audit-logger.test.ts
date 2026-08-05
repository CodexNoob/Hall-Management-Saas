import { describe, expect, it, vi } from "vitest";

import { createActivityLog } from "@/lib/audit/activity-log";

describe("createActivityLog", () => {
  it("writes an organization-scoped activity entry", async () => {
    const create = vi.fn().mockResolvedValue({ id: "audit-1" });
    const prismaClient = {
      activityLog: { create }
    } as never;

    await createActivityLog(prismaClient, {
      organizationId: "org-1",
      userId: "user-1",
      userName: "Ada",
      actionType: "plaid.connection.created",
      message: "Connected a bank account",
      oldValue: { status: "pending" },
      newValue: { status: "connected" }
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        userId: "user-1",
        userName: "Ada",
        actionType: "plaid.connection.created",
        message: "Connected a bank account",
        oldValue: { status: "pending" },
        newValue: { status: "connected" }
      }
    });
  });
});
