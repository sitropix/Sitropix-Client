import { prisma } from "../db/client.mjs";
import { mapSupportTicketListRow, ticketStatusForApi } from "./supportTicketSerialize.mjs";

function refFromRow(row) {
  if (!row) return null;
  return { id: row.id, code: row.code, label: row.label };
}

async function loadEditTypeMap(editTypeIds) {
  const ids = [...new Set(editTypeIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await prisma.editType.findMany({
    where: { id: { in: ids } },
    select: { id: true, code: true, label: true },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

async function loadAddonMap(addonIds) {
  const ids = [...new Set(addonIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await prisma.subscriptionAddon.findMany({
    where: { id: { in: ids } },
    select: { id: true, code: true, label: true },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

export function attachTicketLinkedRefs(ticket, projectNames, editTypeMap, addonMap, options = {}) {
  const attachmentBase =
    options.attachmentApiBase ?? `/api/support/tickets/${ticket.id}/attachments`;

  const linkedFields = {
    editType: refFromRow(ticket.editTypeId ? editTypeMap.get(ticket.editTypeId) : null),
    addon: refFromRow(ticket.subscriptionAddonId ? addonMap.get(ticket.subscriptionAddonId) : null),
  };

  const base =
    ticket.messages != null
      ? {
          id: ticket.id,
          subject: ticket.subject,
          description: ticket.description,
          status: ticketStatusForApi(ticket.status),
          priority: ticket.priority,
          department: ticket.department,
          userPlan: ticket.userPlan,
          projectId: ticket.projectId ?? null,
          projectName: (ticket.projectId && projectNames.get(ticket.projectId)) || null,
          editTypeId: ticket.editTypeId ?? null,
          category: ticket.category ?? "general",
          subscriptionAddonId: ticket.subscriptionAddonId ?? null,
          creditsCharged: ticket.creditsCharged ?? 0,
          workCompleted: ticket.workCompleted ?? null,
          creditsRefunded: ticket.creditsRefunded ?? false,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
          ...linkedFields,
        }
      : {
          ...mapSupportTicketListRow(ticket, projectNames),
          ...linkedFields,
        };

  if (ticket.messages) {
    return {
      ...base,
      messages: ticket.messages.map((m) => ({
        id: m.id,
        body: m.body,
        isStaff: m.isStaff,
        createdAt: m.createdAt,
        author: m.user ? { id: m.user.id, name: m.user.name, email: m.user.email } : null,
        attachments: ticket.attachments
          ?.filter((a) => a.messageId === m.id)
          .map((a) => ({
            id: a.id,
            fileName: a.fileName,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            createdAt: a.createdAt,
            downloadUrl: `${attachmentBase}/${a.id}/download`,
          })),
      })),
    };
  }

  return base;
}

export async function enrichSupportTicketsForApi(tickets, projectNames) {
  const editTypeMap = await loadEditTypeMap(tickets.map((t) => t.editTypeId));
  const addonMap = await loadAddonMap(tickets.map((t) => t.subscriptionAddonId));
  return tickets.map((t) => attachTicketLinkedRefs(t, projectNames, editTypeMap, addonMap));
}

export async function enrichAdminTicketsForApi(tickets, projectNames) {
  const editTypeMap = await loadEditTypeMap(tickets.map((t) => t.editTypeId));
  const addonMap = await loadAddonMap(tickets.map((t) => t.subscriptionAddonId));
  return tickets.map((t) => {
    const linked = attachTicketLinkedRefs(t, projectNames, editTypeMap, addonMap);
    return {
      ...linked,
      threadCount: t._count?.messages ?? t.threadCount ?? 0,
      user: t.user,
    };
  });
}

export async function enrichAdminTicketDetailForApi(ticket, projectNames) {
  const editTypeMap = await loadEditTypeMap([ticket.editTypeId]);
  const addonMap = await loadAddonMap([ticket.subscriptionAddonId]);
  const body = attachTicketLinkedRefs(ticket, projectNames, editTypeMap, addonMap, {
    attachmentApiBase: `/api/admin/tickets/${ticket.id}/attachments`,
  });
  return { ...body, user: ticket.user };
}
