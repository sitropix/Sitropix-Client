/** Map legacy DB enum values to the statuses exposed to the client. */
export function ticketStatusForApi(status) {
  if (status === "closed") return "resolved";
  return status;
}

export function mapSupportTicketListRow(t, projectNames) {
  return {
    id: t.id,
    subject: t.subject,
    description: t.description,
    status: ticketStatusForApi(t.status),
    priority: t.priority,
    department: t.department,
    userPlan: t.userPlan,
    projectId: t.projectId ?? null,
    projectName: (t.projectId && projectNames.get(t.projectId)) || null,
    editTypeId: t.editTypeId ?? null,
    category: t.category ?? "general",
    subscriptionAddonId: t.subscriptionAddonId ?? null,
    creditsCharged: t.creditsCharged ?? 0,
    threadCount: t._count?.messages ?? 0,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}
