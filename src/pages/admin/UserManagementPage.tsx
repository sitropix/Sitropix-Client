import { useEffect, useState } from "react";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
import {
  deactivateAdminUser,
  fetchAdminUserManagement,
  inviteAdminUser,
  reactivateAdminUser,
  sendAdminUserResetLink,
  setAdminUserModuleAccess,
  setAdminUserPassword,
  setAdminUserRole,
} from "@/services/subscriptionsApi";
import { ApiRequestError, isModuleForbiddenError } from "@/services/http";
import { NoModuleAccess } from "@/components/NoModuleAccess";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Role } from "@/types/subscription";

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
] as const;

export function UserManagementPage() {
  const { cache, updateCache } = useAdminPrefetch();
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
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("support");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [moduleDraft, setModuleDraft] = useState<Record<string, boolean>>({});
  const [passwordDraft, setPasswordDraft] = useState("");
  const [savingAccessForUserId, setSavingAccessForUserId] = useState<string | null>(null);
  const [noModuleAccess, setNoModuleAccess] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [teamPage, setTeamPage] = useState(1);
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
      setNotice("Could not load team access data.");
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
    setPasswordDraft("");
    setExpandedUserId(user.id);
  }

  async function saveAccess(userId: string) {
    setSavingAccessForUserId(userId);
    setNotice(null);
    try {
      const next = modules.map((moduleKey) => ({
        moduleKey,
        enabled: moduleDraft[moduleKey] ?? false,
      }));
      await setAdminUserModuleAccess(userId, next);
      await load();
      setExpandedUserId(null);
      setNotice("Access permissions updated.");
    } catch (err) {
      setNotice(toMessage(err, "Could not update module access."));
    } finally {
      setSavingAccessForUserId(null);
    }
  }

  const activeUsers = data.users.filter((u) => u.status === "active" || u.status === "deactivated");
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
        setNotice(`${deactivateConfirm.user.name} has been deactivated.`);
      } else {
        await reactivateAdminUser(deactivateConfirm.user.id);
        setNotice(`${deactivateConfirm.user.name} has been reactivated.`);
      }
      await load();
      setDeactivateConfirm({ open: false, user: null, isActive: true });
    } catch (err) {
      setNotice(toMessage(err, deactivateConfirm.isActive ? "Could not deactivate user." : "Could not reactivate user."));
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
        <h1 className="text-3xl font-black tracking-tight text-white">Team Access</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Manage team members, access roles, deactivation, password actions, and module-level permissions.
        </p>
      </header>

      {notice && <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/90">{notice}</p>}

      <section className="rounded-xl border border-[#24292E] bg-[#15191C] p-5">
        <h2 className="text-sm font-semibold text-white">Invite user</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="rounded border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="rounded border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="rounded border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white"
          >
            <option value="support">Support</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
            <option value="master_admin">Master Admin</option>
          </select>
          <button
            type="button"
            disabled={inviting}
            onClick={() => {
              setInviting(true);
              void inviteAdminUser({ name: name.trim(), email: email.trim(), role })
                .then(async () => {
                  setNotice("Invite sent.");
                  setName("");
                  setEmail("");
                  await load();
                })
                .catch((err) => setNotice(toMessage(err, "Could not send invite.")))
                .finally(() => setInviting(false));
            }}
            className="flex items-center gap-2 rounded bg-brand-lime px-3 py-2 text-sm font-semibold text-canvas disabled:opacity-50"
          >
            {inviting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
            {inviting ? "Sending..." : "Send login details"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-[#24292E] bg-[#15191C]">
        <div className="grid grid-cols-12 border-b border-[#24292E] bg-neutral-900/40 px-4 py-3 text-xs uppercase tracking-widest text-neutral-500">
          <div className="col-span-4">User</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-4 text-right">Actions</div>
        </div>
        {paginatedUsers.length === 0 && (
          <p className="px-4 py-6 text-sm text-neutral-400">No team members yet.</p>
        )}
        {paginatedUsers.map((u) => {
          const expanded = expandedUserId === u.id;
          const isLoading = actionLoading[u.id];
          return (
            <div key={u.id} className="border-b border-[#24292E] last:border-b-0">
              <div className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                <div className="col-span-4">
                  <p className="font-medium text-white">{u.name}</p>
                  <p className="text-xs text-neutral-400">{u.email}</p>
                </div>
                <div className="col-span-2">
                  <select
                    value={u.role}
                    disabled={isLoading}
                    onChange={(e) => {
                      setActionLoading((prev) => ({ ...prev, [u.id]: true }));
                      void setAdminUserRole(u.id, e.target.value as Role)
                        .then(load)
                        .catch((err) => setNotice(toMessage(err, "Could not update role.")))
                        .finally(() => setActionLoading((prev) => ({ ...prev, [u.id]: false })));
                    }}
                    className="rounded border border-[#24292E] bg-[#1C2126] px-2 py-1 text-xs text-white disabled:opacity-50"
                  >
                    <option value="support">Support</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                    <option value="master_admin">Master Admin</option>
                    <option value="user">User</option>
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
                    className={`rounded border px-2 py-1 text-xs ${expanded ? "border-brand-lime/40 bg-brand-lime/10 text-brand-lime" : "border-[#24292E] bg-[#1C2126] text-white"}`}
                  >
                    {expanded ? "Close access" : "Access"}
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      setActionLoading((prev) => ({ ...prev, [u.id]: true }));
                      void sendAdminUserResetLink(u.id)
                        .then(() => setNotice(`Password reset link sent to ${u.email}.`))
                        .catch((err) => setNotice(toMessage(err, "Could not send reset link.")))
                        .finally(() => setActionLoading((prev) => ({ ...prev, [u.id]: false })));
                    }}
                    className="rounded border border-[#24292E] bg-[#1C2126] px-2 py-1 text-xs text-white disabled:opacity-50"
                  >
                    {isLoading ? "..." : "Send reset link"}
                  </button>
                  {u.status === "active" ? (
                    <button
                      type="button"
                      disabled={isLoading}
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
                      disabled={isLoading}
                      onClick={() =>
                        setDeactivateConfirm({ open: true, user: { id: u.id, name: u.name, email: u.email }, isActive: false })
                      }
                      className="rounded border border-brand-lime/35 bg-brand-lime/10 px-2 py-1 text-xs text-brand-lime disabled:opacity-50"
                    >
                      Reactivate
                    </button>
                  )}
                </div>
              </div>

              <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="overflow-hidden">
                  <div className="mx-4 mb-4 rounded-lg border border-[#2b3137] bg-[#1A1F24] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-400">Module access</p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {modules.map((m) => (
                        <label key={m} className="flex items-center justify-between rounded border border-[#2b3137] bg-[#15191C] px-3 py-2 text-sm text-white">
                          <span>{m}</span>
                          <input
                            type="checkbox"
                            checked={moduleDraft[m] ?? false}
                            onChange={(e) => setModuleDraft((prev) => ({ ...prev, [m]: e.target.checked }))}
                            className="accent-brand-lime"
                          />
                        </label>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#2b3137] pt-3">
                      <input
                        value={passwordDraft}
                        onChange={(e) => setPasswordDraft(e.target.value)}
                        type="password"
                        placeholder="Set temporary password"
                        className="rounded border border-[#24292E] bg-[#15191C] px-3 py-2 text-sm text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void setAdminUserPassword(u.id, passwordDraft)
                            .then(() => {
                              setPasswordDraft("");
                              setNotice("Password updated and user notified.");
                            })
                            .catch((err) => setNotice(toMessage(err, "Could not set password.")))
                        }
                        className="rounded border border-[#24292E] bg-[#1C2126] px-3 py-2 text-xs text-white"
                      >
                        Set password directly
                      </button>
                      <button
                        type="button"
                        disabled={savingAccessForUserId === u.id}
                        onClick={() => void saveAccess(u.id)}
                        className="ml-auto flex items-center gap-2 rounded bg-brand-lime px-4 py-2 text-xs font-semibold text-canvas disabled:opacity-50"
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
          <div className="flex items-center justify-between border-t border-[#24292E] px-4 py-3">
            <p className="text-xs text-neutral-500">
              Page {teamPage} of {totalTeamPages} ({activeUsers.length} total)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={teamPage === 1}
                onClick={() => setTeamPage((p) => p - 1)}
                className="rounded border border-[#24292E] bg-[#1C2126] px-3 py-1.5 text-xs text-white disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={teamPage >= totalTeamPages}
                onClick={() => setTeamPage((p) => p + 1)}
                className="rounded border border-[#24292E] bg-[#1C2126] px-3 py-1.5 text-xs text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

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

