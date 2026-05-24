import { Outlet } from "react-router-dom";
import { AuthShell } from "@/components/AuthShell";

export function AuthLayout() {
  return (
    <AuthShell>
      <Outlet />
    </AuthShell>
  );
}
