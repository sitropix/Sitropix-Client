import { prisma } from "../db/client.mjs";
import { sendTransactionalEmail } from "./emailService.mjs";
import { escapeHtml } from "../utils/htmlEscape.mjs";
import { env } from "../config/env.mjs";
import { WORKFLOW_LABEL } from "./projectWorkflowService.mjs";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Build a per-customer "what we shipped this week" digest payload.
 * Only includes projects with workflow activity in the last 7 days.
 */
export async function buildWeeklyDigestForCustomer(userId, now = new Date()) {
  const since = new Date(now.getTime() - ONE_WEEK_MS);
  const projects = await prisma.project.findMany({
    where: {
      ownerUserId: userId,
      OR: [
        { lastDesignerActivityAt: { gte: since } },
        { workflowChangedAt: { gte: since } },
        { approvedDesignAt: { gte: since } },
        { approvedLaunchAt: { gte: since } },
      ],
    },
    include: {
      assignedDesigner: { select: { name: true } },
    },
    orderBy: { workflowChangedAt: "desc" },
  });

  if (projects.length === 0) return null;

  const blocks = projects.map((p) => {
    const events = [];
    if (p.workflowChangedAt && p.workflowChangedAt > since) {
      events.push(`Status: <strong>${escapeHtml(WORKFLOW_LABEL[p.workflowStatus] ?? p.workflowStatus)}</strong>`);
    }
    if (p.lastDesignerActivityAt && p.lastDesignerActivityAt > since) {
      events.push(`Your designer ${p.assignedDesigner?.name ? `(${escapeHtml(p.assignedDesigner.name)}) ` : ""}sent updates`);
    }
    if (p.approvedDesignAt && p.approvedDesignAt > since) events.push("You approved the design");
    if (p.approvedLaunchAt && p.approvedLaunchAt > since) events.push("You approved the launch");
    if (p.liveUrl && p.workflowStatus === "live") events.push(`Live at <a href="${escapeHtml(p.liveUrl)}">${escapeHtml(p.liveUrl)}</a>`);
    return `<div style="margin:18px 0;padding:12px;border-left:3px solid #15728C;background:#f7fafb;">
  <h3 style="margin:0 0 6px;font-size:16px;color:#102d3a;">${escapeHtml(p.name)}</h3>
  <ul style="margin:0;padding-left:18px;color:#445;">
    ${events.map((e) => `<li>${e}</li>`).join("")}
  </ul>
  <p style="margin:8px 0 0;font-size:13px;"><a href="${env.appUrl}/projects/${p.id}">Open project</a></p>
</div>`;
  });

  return {
    projectCount: projects.length,
    html: `<h2 style="color:#102d3a;">This week on your projects</h2>${blocks.join("")}<p style="font-size:12px;color:#889;">You're getting this because at least one of your projects had activity this week. Mute per-project alerts from each project's settings.</p>`,
    subject: `Sitropix weekly: ${projects.length} project${projects.length === 1 ? "" : "s"} updated`,
  };
}

/** Send the digest to a single customer if they have activity. Returns sent/skipped status. */
export async function sendWeeklyDigestForCustomer(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.isActive === false) return { skipped: "user_inactive" };
  const digest = await buildWeeklyDigestForCustomer(userId);
  if (!digest) return { skipped: "no_activity" };
  const week = new Date().toISOString().slice(0, 10);
  await sendTransactionalEmail({
    to: user.email,
    template: "weekly_project_digest",
    idempotencyKey: `weekly_digest_${user.id}_${week}`,
    subject: digest.subject,
    html: digest.html,
  });
  return { sent: true, projectCount: digest.projectCount };
}

/** Walk every customer with at least one project; admin-trigger only. */
export async function runWeeklyDigestForAllCustomers() {
  const users = await prisma.user.findMany({
    where: {
      role: "user",
      isActive: true,
      projects: { some: {} },
    },
    select: { id: true },
  });
  const results = { totalCandidates: users.length, sent: 0, skipped: 0 };
  for (const u of users) {
    const r = await sendWeeklyDigestForCustomer(u.id);
    if (r.sent) results.sent += 1;
    else results.skipped += 1;
  }
  return results;
}
