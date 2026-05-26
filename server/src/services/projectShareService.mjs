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
 * Issue / regenerate a share token.
 * - expiresInDays = number > 0 → set new expiry that many days out
 * - expiresInDays = null → explicitly set no expiry
 * - expiresInDays = undefined → preserve existing expiry (Regenerate use-case)
 * Always sets shareLinkEnabled = true.
 */
export async function issueShareLink(projectId, expiresInDays) {
  const token = newShareToken();
  const data = {
    shareLinkToken: token,
    shareLinkEnabled: true,
  };
  if (expiresInDays === undefined) {
    // Preserve whatever expiresAt the row already has.
  } else if (expiresInDays === null) {
    data.shareLinkExpiresAt = null;
  } else if (typeof expiresInDays === "number" && expiresInDays > 0) {
    data.shareLinkExpiresAt = new Date(Date.now() + expiresInDays * 86_400_000);
  }
  const updated = await prisma.project.update({
    where: { id: projectId },
    data,
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
