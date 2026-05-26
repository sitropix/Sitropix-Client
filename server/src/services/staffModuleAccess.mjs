/** Default admin module keys granted when a staff role is assigned. */
const ALL_MODULES = [
  "dashboard",
  "customers",
  "users",
  "plans",
  "invites",
  "features",
  "audit_logs",
  "email",
  "environment",
  "tickets",
  "forms",
  "crm",
  "projects",
  "designer",
];

const MANAGER_MODULES = [
  "dashboard",
  "customers",
  "plans",
  "invites",
  "audit_logs",
  "tickets",
  "forms",
  "crm",
  "projects",
  "designer",
];

/** Support staff default: tickets + designer queue (so a support user picked up as designer can use their queue). */
const SUPPORT_MODULES = ["tickets", "designer"];

export function moduleKeysForStaffRole(role) {
  if (role === "master_admin" || role === "admin") return ALL_MODULES;
  if (role === "manager") return MANAGER_MODULES;
  if (role === "support") return SUPPORT_MODULES;
  return [];
}

export async function ensureStaffModuleAccess(prisma, userId, role) {
  const keys = moduleKeysForStaffRole(role);
  if (keys.length === 0) return;
  await prisma.userModuleAccess.createMany({
    data: keys.map((moduleKey) => ({ userId, moduleKey, enabled: true })),
    skipDuplicates: true,
  });
}
