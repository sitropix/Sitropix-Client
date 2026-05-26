import crypto from "node:crypto";
import { prisma } from "../db/client.mjs";

/** Generate a 128-bit URL-safe token. Stored verbatim (it's a capability, not a credential). */
export function newShareToken() {
  return crypto.randomBytes(24).toString("base64url");
}

/** Public payload — intentionally narrow. Never includes payment amounts, customer email, or chat content. */
export function buildPublicSharePayload(project, owner, assignedDesigner, recentActivity) {
  return {
    schemaVersion: "1",
    name: project.name,
    description: project.description ?? "",
    customerName: owner?.name ?? null,
    workflowStatus: project.workflowStatus,
    progressPercent: project.phaseProgressPercent > 0
      ? project.phaseProgressPercent
      : null,
    stagingUrl: project.stagingUrl ?? null,
    liveUrl: project.liveUrl ?? null,
    assignedDesignerName: assignedDesigner?.name ?? null,
    lastUpdateAt: project.updatedAt?.toISOString?.() ?? null,
    recentActivity: (recentActivity ?? []).map((a) => ({
      action: a.action,
      at: a.createdAt?.toISOString?.() ?? null,
    })),
    poweredBy: "Sitropix",
  };
}

/**
 * Issue / regenerate a share token. expiresInDays null → no expiry.
 * Always sets shareLinkEnabled = true.
 */
export async function issueShareLink(projectId, expiresInDays) {
  const token = newShareToken();
  const expiresAt =
    typeof expiresInDays === "number" && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 86_400_000)
      : null;
  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      shareLinkToken: token,
      shareLinkExpiresAt: expiresAt,
      shareLinkEnabled: true,
    },
  });
  return { token, expiresAt: updated.shareLinkExpiresAt };
}

export async function revokeShareLink(projectId) {
  await prisma.project.update({
    where: { id: projectId },
    data: {
      shareLinkToken: null,
      shareLinkExpiresAt: null,
      shareLinkEnabled: false,
    },
  });
}
