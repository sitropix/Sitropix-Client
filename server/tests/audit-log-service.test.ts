import { describe, expect, it, vi, beforeEach } from "vitest";

const createMock = vi.fn();

vi.mock("../src/db/client.mjs", () => ({
  prisma: {
    auditLog: {
      create: createMock,
    },
  },
}));

vi.mock("../src/config/env.mjs", () => ({
  env: {
    auditLogEnabled: true,
  },
}));

describe("auditLogService", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("writes audit event payload", async () => {
    const { logAuditEvent } = await import("../src/services/auditLogService.mjs");
    await logAuditEvent({
      action: "admin.plan_created",
      actorUserId: "user_1",
      actorRole: "admin",
      targetType: "plan",
      targetId: "plan_1",
      metadata: { code: "pro" },
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0][0]).toMatchObject({
      data: expect.objectContaining({
        action: "admin.plan_created",
        actorUserId: "user_1",
        actorRole: "admin",
        targetType: "plan",
        targetId: "plan_1",
      }),
    });
  });
});

