import { useEffect, useState } from "react";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
import {
  deactivateAdminUser,
  fetchAdminUserManagement,
  inviteAdminUser,
  reactivateAdminUser,
  sendAdminUserResetLink,
  setAdminUserPassword,
  setAdminUserModuleAccess,
  setAdminUserRole,
} from "@/services/subscriptionsApi";
import { ApiRequestError, isModuleForbiddenError } from "@/services/http";
import { NoModuleAccess } from "@/components/NoModuleAccess";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import type { Role } from "@/types/subscription";
import { useAuth } from "@/context/AuthContext";

const TEAM_PAGE_SIZE = 10;

const modules = [
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
] as const;

export function UserManagementPage() {
  const { cache, updateCache } = useAdminPrefetch();
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();
  const isMasterAdmin = user?.role === "master_admin";
  const [data, setData] = useState<{
    users: Array<{
      id: string;
      email: string;
      name: string;
      role: Role;
      status: "active" | "deactivated";
      moduleAccess?: Array<{ moduleKey: string; enabled: boolean }>;
      createdAt: string;
    }>;
  }>({ users: [] });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("support");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [moduleDraft, setModuleDraft] = useState<Record<string, boolean>>({});
  const [savingAccessForUserId, setSavingAccessForUserId] = useState<string | null>(null);
  const [moduleAccessSaving, setModuleAccessSaving] = useState(false);
  const [noModuleAccess, setNoModuleAccess] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [teamPage, setTeamPage] = useState(1);
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{
    open: boolean;
    user: { id: string; name: string; email: string } | null;
  }>({ open: false, user: null });
  const [customPasswordDraft, setCustomPasswordDraft] = useState("");
  const [resetActionLoading, setResetActionLoading] = useState<"set_password" | "send_link" | null>(null);
  const [deactivateConfirm, setDeactivateConfirm] = useState<{
    open: boolean;
    user: { id: string; name: string; email: string } | null;
    isActive: boolean;
  }>({ open: false, user: null, isActive: true });

  function toMessage(err: unknown, fallback: string) {
    if (err instanceof ApiRequestError) return err.message || fallback;
    return fallback;
  }

  async function load() {
    setNoModuleAccess(false);
    const next = await fetchAdminUserManagement();
    setData({ users: next.users });
    updateCache({ userManagement: next });
  }

  useEffect(() => {
    if (cache.userManagement) setData({ users: cache.userManagement.users });
    void load().catch((err) => {
      if (isModuleForbiddenError(err)) {
        setNoModuleAccess(true);
        return;
      }
      showError("Could not load team access data.");
    });
  }, []);

  function toggleAccessPanel(user: (typeof data.users)[number]) {
    if (expandedUserId === user.id) {
      setExpandedUserId(null);
      return;
    }
    const next: Record<string, boolean> = {};
    for (const key of modules) {
      next[key] = user.moduleAccess?.find((x) => x.moduleKey === key)?.enabled ?? false;
    }
    setModuleDraft(next);
    setExpandedUserId(user.id);
  }

  async function saveAccess(userId: string) {
    if (!isMasterAdmin) return;
    setSavingAccessForUserId(userId);
    setModuleAccessSaving(true);
    try {
      const next = modules.map((moduleKey) => ({
        moduleKey,
        enabled: moduleDraft[moduleKey] ?? false,
      }));
      await setAdminUserModuleAccess(userId, next);
      await load();
      setExpandedUserId(null);
      showSuccess("Access permissions updated.");
    } catch (err) {
      showError(toMessage(err, "Could not update module access."));
    } finally {
      setSavingAccessForUserId(null);
      setModuleAccessSaving(false);
    }
  }

  function openResetPasswordDialog(user: { id: string; name: string; email: string }) {
    setCustomPasswordDraft("");
    setResetActionLoading(null);
    setResetPasswordDialog({ open: true, user });
  }

  function closeResetPasswordDialog() {
    if (resetActionLoading) return;
    setResetPasswordDialog({ open: false, user: null });
    setCustomPasswordDraft("");
  }

  async function handleSendResetLink() {
    const user = resetPasswordDialog.user;
    if (!user) return;
    setResetActionLoading("send_link");
    try {
      await sendAdminUserResetLink(user.id);
      showSuccess(`Password reset link sent to ${user.email}.`);
      setResetPasswordDialog({ open: false, user: null });
      setCustomPasswordDraft("");
    } catch (err) {
      showError(toMessage(err, "Could not send reset link."));
    } finally {
      setResetActionLoading(null);
    }
  }

  async function handleSetCustomPassword() {
    const user = resetPasswordDialog.user;
    if (!user) return;
    const nextPassword = customPasswordDraft.trim();
    if (nextPassword.length < 8) {
      showError("Password must be at least 8 characters.");
      return;
    }
    setResetActionLoading("set_password");
    try {
      await setAdminUserPassword(user.id, nextPassword);
      showSuccess(`Password updated for ${user.email}.`);
      setResetPasswordDialog({ open: false, user: null });
      setCustomPasswordDraft("");
    } catch (err) {
      showError(toMessage(err, "Could not set password."));
    } finally {
      setResetActionLoading(null);
    }
  }

  const activeUsers = data.users.filter(
    (u) => u.role !== "user" && (u.status === "active" || u.status === "deactivated"),
  );
  const totalTeamPages = Math.ceil(activeUsers.length / TEAM_PAGE_SIZE);
  const paginatedUsers = activeUsers.slice(
    (teamPage - 1) * TEAM_PAGE_SIZE,
    teamPage * TEAM_PAGE_SIZE
  );

  async function handleDeactivateReactivate() {
    if (!deactivateConfirm.user) return;
    setActionLoading((prev) => ({ ...prev, [deactivateConfirm.user!.id]: true }));
    try {
      if (deactivateConfirm.isActive) {
        await deactivateAdminUser(deactivateConfirm.user.id);
        showSuccess(`${deactivateConfirm.user.name} has been deactivated.`);
      } else {
        await reactivateAdminUser(deactivateConfirm.user.id);
        showSuccess(`${deactivateConfirm.user.name} has been reactivated.`);
      }
      await load();
      setDeactivateConfirm({ open: false, user: null, isActive: true });
    } catch (err) {
      showError(toMessage(err, deactivateConfirm.isActive ? "Could not deactivate user." : "Could not reactivate user."));
    } finally {
      setActionLoading((prev) => ({ ...prev, [deactivateConfirm.user!.id]: false }));
    }
  }

  if (noModuleAccess) {
    return <NoModuleAccess moduleLabel="Team Access" />;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-sx-xl font-semibold tracking-tight text-[var(--text-primary)]">Team Access</h1>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">
          Manage team members, access roles, deactivation, password actions, and module-level permissions.
        </p>
        {!isMasterAdmin && (
          <p className="mt-2 text-xs text-amber-300">
            Read-only mode: only master admins can edit team access, roles, invites, and account actions.
          </p>
        )}
      </header>

      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Invite user</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isMasterAdmin}
            placeholder="Full name"
            className="rounded border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!isMasterAdmin}
            placeholder="Email"
            className="rounded border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            disabled={!isMasterAdmin}
            className="rounded border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="support">Support</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
            <option value="master_admin">Master Admin</option>
          </select>
          <button
            type="button"
            disabled={!isMasterAdmin || inviting}
            onClick={() => {
              setInviting(true);
              void inviteAdminUser({ name: name.trim(), email: email.trim(), role })
                .then(async () => {
                  showSuccess("Invite sent successfully.");
                  setName("");
                  setEmail("");
                  await load();
                })
                .catch((err) => showError(toMessage(err, "Could not send invite.")))
                .finally(() => setInviting(false));
            }}
            className="flex items-center gap-2 rounded bg-[var(--color-brand-500)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {inviting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
            {inviting ? "Sending..." : "Send login details"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
        <div className="grid grid-cols-12 border-b border-[var(--border-subtle)] bg-neutral-900/40 px-4 py-3 text-xs uppercase tracking-widest text-[var(--text-tertiary)]">
          <div className="col-span-4">User</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-4 text-right">Actions</div>
        </div>
        {paginatedUsers.length === 0 && (
          <p className="px-4 py-6 text-sm text-[var(--text-tertiary)]">No team members yet.</p>
        )}
        {paginatedUsers.map((u) => {
          const expanded = expandedUserId === u.id;
          const isLoading = actionLoading[u.id];
          return (
            <div key={u.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
              <div className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                <div className="col-span-4">
                  <p className="font-medium text-[var(--text-primary)]">{u.name}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">{u.email}</p>
                </div>
                <div className="col-span-2">
                  <select
                    value={u.role}
                    disabled={!isMasterAdmin || isLoading}
                    onChange={(e) => {
                      setActionLoading((prev) => ({ ...prev, [u.id]: true }));
                      void setAdminUserRole(u.id, e.target.value as Role)
                        .then(() => {
                          showSuccess("Role updated successfully.");
                          return load();
                        })
                        .catch((err) => showError(toMessage(err, "Could not update role.")))
                        .finally(() => setActionLoading((prev) => ({ ...prev, [u.id]: false })));
                    }}
                    className="rounded border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-2 py-1 text-xs text-[var(--text-primary)] disabled:opacity-50"
                  >
                    <option value="support">Support</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                    <option value="master_admin">Master Admin</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${u.status === "active" ? "bg-emerald-500/15 text-emerald-200" : "bg-amber-500/15 text-amber-200"}`}>
                    {u.status === "active" ? "Active" : "Deactivated"}
                  </span>
                </div>
                <div className="col-span-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => toggleAccessPanel(u)}
                    className={`rounded border px-2 py-1 text-xs ${expanded ? "border-[var(--color-brand-500)]/40 bg-[var(--color-brand-50)] text-[var(--color-brand-600)]" : "border-[var(--border-subtle)] bg-[var(--surface-sunken)] text-[var(--text-primary)]"}`}
                  >
                    {expanded ? "Close access" : "Access"}
                  </button>
                  <button
                    type="button"
                    disabled={!isMasterAdmin || isLoading}
                    onClick={() => openResetPasswordDialog({ id: u.id, name: u.name, email: u.email })}
                    className="rounded border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-2 py-1 text-xs text-[var(--text-primary)] disabled:opacity-50"
                  >
                    Reset password
                  </button>
                  {u.status === "active" ? (
                    <button
                      type="button"
                      disabled={!isMasterAdmin || isLoading}
                      onClick={() =>
                        setDeactivateConfirm({ open: true, user: { id: u.id, name: u.name, email: u.email }, isActive: true })
                      }
                      className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-100 disabled:opacity-50"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!isMasterAdmin || isLoading}
                      onClick={() =>
                        setDeactivateConfirm({ open: true, user: { id: u.id, name: u.name, email: u.email }, isActive: false })
                      }
                      className="rounded border border-[var(--color-brand-500)]/35 bg-[var(--color-brand-50)] px-2 py-1 text-xs text-[var(--color-brand-600)] disabled:opacity-50"
                    >
                      Reactivate
                    </button>
                  )}
                </div>
              </div>

              <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="overflow-hidden">
                  <div className="mx-4 mb-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Module access</p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {modules.map((m) => (
                        <label key={m} className="flex items-center justify-between rounded border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)]">
                          <span>{m}</span>
                          <input
                            type="checkbox"
                            checked={moduleDraft[m] ?? false}
                            disabled={!isMasterAdmin}
                            onChange={(e) => setModuleDraft((prev) => ({ ...prev, [m]: e.target.checked }))}
                            className="accent-[var(--color-brand-500)]"
                          />
                        </label>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
                      <button
                        type="button"
                        disabled={savingAccessForUserId === u.id || moduleAccessSaving || !isMasterAdmin}
                        onClick={() => void saveAccess(u.id)}
                        className="ml-auto flex items-center gap-2 rounded bg-[var(--color-brand-500)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {savingAccessForUserId === u.id && (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        )}
                        {savingAccessForUserId === u.id ? "Saving..." : "Save access"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {activeUsers.length > TEAM_PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-4 py-3">
            <p className="text-xs text-[var(--text-tertiary)]">
              Page {teamPage} of {totalTeamPages} ({activeUsers.length} total)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={teamPage === 1}
                onClick={() => setTeamPage((p) => p - 1)}
                className="rounded border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-1.5 text-xs text-[var(--text-primary)] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={teamPage >= totalTeamPages}
                onClick={() => setTeamPage((p) => p + 1)}
                className="rounded border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-1.5 text-xs text-[var(--text-primary)] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={resetPasswordDialog.open}
        title={resetPasswordDialog.user ? `Reset password for ${resetPasswordDialog.user.name}` : "Reset password"}
        description="Choose one action below. Set a custom password directly, or send a reset link to the user email."
        confirmLabel="Send reset link"
        cancelLabel="Close"
        loading={resetActionLoading === "send_link"}
        onConfirm={() => void handleSendResetLink()}
        onCancel={closeResetPasswordDialog}
      >
        <div className="space-y-3">
          <input
            type="password"
            value={customPasswordDraft}
            onChange={(e) => setCustomPasswordDraft(e.target.value)}
            placeholder="Set custom password (min 8 chars)"
            disabled={Boolean(resetActionLoading)}
            className="w-full rounded border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void handleSetCustomPassword()}
            disabled={Boolean(resetActionLoading)}
            className="w-full rounded border border-[var(--color-brand-500)]/35 bg-[var(--color-brand-50)] px-3 py-2 text-sm font-semibold text-[var(--color-brand-600)] disabled:opacity-50"
          >
            {resetActionLoading === "set_password" ? "Setting password..." : "Set custom password"}
          </button>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={deactivateConfirm.open}
        title={deactivateConfirm.isActive ? "Deactivate team member" : "Reactivate team member"}
        description={
          deactivateConfirm.isActive
            ? `Are you sure you want to deactivate ${deactivateConfirm.user?.name}? They will lose access to the admin portal.`
            : `Are you sure you want to reactivate ${deactivateConfirm.user?.name}? They will regain access to the admin portal.`
        }
        confirmLabel={deactivateConfirm.isActive ? "Deactivate" : "Reactivate"}
        variant={deactivateConfirm.isActive ? "warning" : "default"}
        loading={actionLoading[deactivateConfirm.user?.id ?? ""] ?? false}
        onConfirm={() => void handleDeactivateReactivate()}
        onCancel={() => setDeactivateConfirm({ open: false, user: null, isActive: true })}
      />
    </div>
  );
}
