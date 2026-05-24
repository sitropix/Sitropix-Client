import { prisma } from "../db/client.mjs";
import { env } from "../config/env.mjs";
import { log } from "../observability/logger.mjs";

export async function logAuditEvent(event) {
  if (!env.auditLogEnabled) return;
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: event.actorUserId ?? null,
        actorRole: event.actorRole ?? null,
        action: event.action,
        targetType: event.targetType ?? null,
        targetId: event.targetId ?? null,
        requestId: event.requestId ?? null,
        ipAddress: event.ipAddress ?? null,
        userAgent: event.userAgent ?? null,
        metadata: event.metadata ?? {},
      },
    });
  } catch (e) {
    log.warn("audit_log.write_failed", { error: e?.message });
  }
}

export function requestAuditContext(req) {
  return {
    requestId: req?.requestId ?? req.headers["x-request-id"] ?? null,
    ipAddress: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  };
}

