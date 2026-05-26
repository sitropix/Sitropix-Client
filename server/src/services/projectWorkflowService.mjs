import { prisma } from "../db/client.mjs";
import { logAuditEvent } from "./auditLogService.mjs";

/** Display order for the phase tracker and progress-bar derivation. */
export const WORKFLOW_PHASE_ORDER = [
  "awaiting_brief",
  "awaiting_assets",
  "ready_to_start",
  "in_progress",
  "in_review",
  "revisions_requested",
  "approved",
  "live",
];

/** Side-channel states that don't sit on the linear timeline. */
export const WORKFLOW_OFF_PHASE = new Set(["awaiting_customer_reply", "on_hold"]);

export const WORKFLOW_LABEL = {
  awaiting_brief: "Awaiting brief",
  awaiting_assets: "Awaiting assets",
  ready_to_start: "Ready to start",
  in_progress: "In progress",
  awaiting_customer_reply: "Waiting on customer",
  in_review: "In review",
  revisions_requested: "Revisions requested",
  approved: "Approved",
  live: "Live",
  on_hold: "On hold",
};

/** Derived 0-100 progress from workflow status; designer override wins when > 0. */
export function deriveProgressPercent(status, overridePercent) {
  if (typeof overridePercent === "number" && overridePercent > 0 && overridePercent <= 100) {
    return Math.min(100, Math.max(0, Math.trunc(overridePercent)));
  }
  if (status === "on_hold") return 0;
  if (status === "awaiting_customer_reply") {
    // Stay at whatever phase the designer was in; default 50% if unknown.
    return 50;
  }
  const idx = WORKFLOW_PHASE_ORDER.indexOf(status);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / WORKFLOW_PHASE_ORDER.length) * 100);
}

/** Single source of truth for updating workflow status with audit + timestamp updates. */
export async function updateWorkflowStatus({
  projectId,
  toStatus,
  actorUserId,
  actorRole,
  reason,
  auditCtx,
}) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw Object.assign(new Error("project_not_found"), { httpStatus: 404 });
  if (project.workflowStatus === toStatus) return project;
  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      workflowStatus: toStatus,
      workflowChangedAt: new Date(),
    },
  });
  await logAuditEvent({
    actorUserId,
    actorRole,
    action: "project.workflow_changed",
    targetType: "project",
    targetId: projectId,
    metadata: {
      fromStatus: project.workflowStatus,
      toStatus,
      reason: reason ?? null,
    },
    ...(auditCtx ?? {}),
  });
  return updated;
}

/**
 * After a chat message lands, flip workflow to reflect who needs to act next.
 * Customer→staff: was awaiting_customer_reply → restore likely "in_progress" or "in_review".
 * Staff→customer: was in_progress / awaiting_brief → awaiting_customer_reply (only when a question was asked).
 * Callers pass `markWaiting:true` to express the staff message is a question.
 */
export async function applyChatActivity({
  project,
  isStaff,
  markWaiting,
  actorUserId,
  actorRole,
  auditCtx,
}) {
  const now = new Date();
  const data = {};
  if (isStaff) {
    data.lastDesignerActivityAt = now;
    data.designerHeartbeatAt = now;
  } else {
    data.lastCustomerActivityAt = now;
  }
  await prisma.project.update({ where: { id: project.id }, data });

  if (isStaff && markWaiting && project.workflowStatus !== "awaiting_customer_reply") {
    await updateWorkflowStatus({
      projectId: project.id,
      toStatus: "awaiting_customer_reply",
      actorUserId,
      actorRole,
      reason: "chat_question_to_customer",
      auditCtx,
    });
  } else if (!isStaff && project.workflowStatus === "awaiting_customer_reply") {
    await updateWorkflowStatus({
      projectId: project.id,
      toStatus: "in_progress",
      actorUserId,
      actorRole,
      reason: "customer_replied",
      auditCtx,
    });
  }
}

/** Snapshot the workflow + assignment fields for API responses. */
export function workflowSnapshot(project, assignedDesigner) {
  return {
    workflowStatus: project.workflowStatus,
    workflowLabel: WORKFLOW_LABEL[project.workflowStatus] ?? project.workflowStatus,
    workflowChangedAt: project.workflowChangedAt?.toISOString?.() ?? null,
    progressPercent: deriveProgressPercent(project.workflowStatus, project.phaseProgressPercent),
    phaseProgressOverride: project.phaseProgressPercent,
    assignedDesigner: assignedDesigner
      ? {
          id: assignedDesigner.id,
          name: assignedDesigner.name,
          email: assignedDesigner.email,
        }
      : null,
    lastCustomerActivityAt: project.lastCustomerActivityAt?.toISOString?.() ?? null,
    lastDesignerActivityAt: project.lastDesignerActivityAt?.toISOString?.() ?? null,
    designerHeartbeatAt: project.designerHeartbeatAt?.toISOString?.() ?? null,
    designerActivelyWorking: project.designerHeartbeatAt
      ? Date.now() - new Date(project.designerHeartbeatAt).getTime() < 2 * 60 * 60 * 1000
      : false,
    stagingUrl: project.stagingUrl ?? null,
    liveUrl: project.liveUrl ?? null,
    approvedDesignAt: project.approvedDesignAt?.toISOString?.() ?? null,
    approvedLaunchAt: project.approvedLaunchAt?.toISOString?.() ?? null,
    brandVoiceShort: project.brandVoiceShort ?? "",
    notifyOnDesignerReply: project.notifyOnDesignerReply,
    notifyOnPhaseChange: project.notifyOnPhaseChange,
    pendingCheckoutSessionId: project.pendingCheckoutSessionId ?? null,
    pendingCheckoutSessionAt: project.pendingCheckoutSessionAt?.toISOString?.() ?? null,
    shareLinkEnabled: project.shareLinkEnabled,
    shareLinkExpiresAt: project.shareLinkExpiresAt?.toISOString?.() ?? null,
  };
}

/**
 * Suggested next action shown on the dashboard. Drives the big "what do I do now?" card.
 * Returns null when the project is in a state with no clear customer-facing CTA.
 */
export function deriveNextAction(project, options = {}) {
  const { hasUploadedAssets = false, hasUnreadDesignerMessage = false } = options;
  switch (project.workflowStatus) {
    case "awaiting_brief":
      return {
        kind: "fill_brief",
        title: "Tell us about your project",
        body: "Add a short description and your brand voice so we know what you want.",
        cta: "Add brand voice",
        href: "#brand-voice",
      };
    case "awaiting_assets":
      return {
        kind: "upload_assets",
        title: hasUploadedAssets ? "Add a few more files" : "Upload your logo + brand assets",
        body: "Your designer needs these to start building.",
        cta: "Upload files",
        href: "#project-files",
      };
    case "ready_to_start":
      return {
        kind: "wait",
        title: "Your designer will start soon",
        body: "We have everything we need. You'll get an update when work begins.",
        cta: null,
        href: null,
      };
    case "in_progress":
      return {
        kind: "wait",
        title: "Build in progress",
        body: hasUnreadDesignerMessage
          ? "Your designer sent a new message."
          : "Your designer is working on your site. No action needed.",
        cta: hasUnreadDesignerMessage ? "Open chat" : null,
        href: hasUnreadDesignerMessage ? "#project-chat" : null,
      };
    case "awaiting_customer_reply":
      return {
        kind: "reply_chat",
        title: "Your designer is waiting on a reply",
        body: "Check the project chat for the open question.",
        cta: "Open chat",
        href: "#project-chat",
      };
    case "in_review":
      return {
        kind: "approve_design",
        title: "Review your design",
        body: "Take a look and approve, or request revisions in chat.",
        cta: "Approve design",
        href: "#approval",
      };
    case "revisions_requested":
      return {
        kind: "wait",
        title: "Revisions in progress",
        body: "Your designer is making the changes you requested.",
        cta: null,
        href: null,
      };
    case "approved":
      return {
        kind: "approve_launch",
        title: "Ready for launch",
        body: "Approve launch when you're happy and we'll publish.",
        cta: "Approve launch",
        href: "#approval",
      };
    case "live":
      return {
        kind: "live",
        title: "Your site is live",
        body: project.liveUrl ? "Click below to open it." : "Live URL coming soon.",
        cta: project.liveUrl ? "Open site" : null,
        href: project.liveUrl ?? null,
      };
    case "on_hold":
      return {
        kind: "wait",
        title: "Project is on hold",
        body: "Contact support if you need to resume work.",
        cta: "Open support",
        href: "/help",
      };
    default:
      return null;
  }
}
