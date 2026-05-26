import express from "express";
import { prisma } from "../db/client.mjs";
import { buildPublicSharePayload } from "../services/projectShareService.mjs";

const router = express.Router();

/** Public, no-auth read-only view of a project. Token-gated. Never includes payments or chat. */
router.get("/projects/:token", async (req, res) => {
  const token = String(req.params.token ?? "").trim();
  if (token.length < 16) return res.status(404).json({ error: "not_found" });
  const project = await prisma.project.findUnique({
    where: { shareLinkToken: token },
    include: {
      owner: { select: { name: true } },
      assignedDesigner: { select: { name: true } },
    },
  });
  if (!project || !project.shareLinkEnabled) return res.status(404).json({ error: "not_found" });
  if (project.shareLinkExpiresAt && project.shareLinkExpiresAt.getTime() < Date.now()) {
    return res.status(410).json({ error: "share_link_expired" });
  }
  const recent = await prisma.auditLog.findMany({
    where: { targetType: "project", targetId: project.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { action: true, createdAt: true },
  });
  return res.json(buildPublicSharePayload(project, project.owner, project.assignedDesigner, recent));
});

export { router as projectShareRouter };
