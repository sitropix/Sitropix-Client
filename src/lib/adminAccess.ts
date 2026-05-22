import type { Role } from "@/types/subscription";

export function canAccessAdminPortal(role: Role): boolean {
  return role === "admin" || role === "master_admin" || role === "support";
}

/** Default landing route after staff sign-in. */
export function adminHomePath(role: Role): string {
  if (role === "support") return "/admin/tickets";
  if (role === "admin" || role === "master_admin") return "/admin";
  return "/dashboard";
}

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
