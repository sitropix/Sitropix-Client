import { prisma } from "../db/client.mjs";

/**
 * Load project display names for support ticket rows that only expose `projectId`
 * (avoids relying on Prisma `include: { project }` when the generated client is stale).
 */
export async function projectNameByIdForTickets(rows) {
  const ids = [...new Set(rows.map((r) => r.projectId).filter(Boolean))];
  if (ids.length === 0) return new Map();
  const projects = await prisma.project.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return new Map(projects.map((p) => [p.id, p.name]));
}
