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
import type { Role } from "@/types/subscription";

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
    invites: Array<{ id: string; email: string; createdAt: string; expiresAt: string; status: "invite_pending" }>;
  }>({ users: [], invites: [] });
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("support");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [moduleDraft, setModuleDraft] = useState<Record<string, boolean>>({});
  const [passwordDraft, setPasswordDraft] = useState("");
  const [savingAccessForUserId, setSavingAccessForUserId] = useState<string | null>(null);
  const [noModuleAccess, setNoModuleAccess] = useState(false);

  function toMessage(err: unknown, fallback: string) {
    if (err instanceof ApiRequestError) return err.message || fallback;
    return fallback;
  }

  async function load() {
    setNoModuleAccess(false);
    const next = await fetchAdminUserManagement();
    setData(next);
    updateCache({ userManagement: next });
  }

  useEffect(() => {
    if (cache.userManagement) setData(cache.userManagement);
    void load().catch((err) => {
      if (isModuleForbiddenError(err)) {
        setNoModuleAccess(true);
        return;
      }
      setNotice("Could not load user management.");
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

  if (noModuleAccess) {
    return <NoModuleAccess moduleLabel="User Management" />;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-white">User Management</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Manage invited users, access roles, deactivation, password actions, and module-level permissions.
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
            onClick={() =>
              void inviteAdminUser({ name: name.trim(), email: email.trim(), role })
                .then(async () => {
                  setNotice("Invite sent.");
                  setName("");
                  setEmail("");
                  await load();
                })
                .catch((err) => setNotice(toMessage(err, "Could not send invite.")))
            }
            className="rounded bg-brand-lime px-3 py-2 text-sm font-semibold text-canvas"
          >
            Send login details
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-[#24292E] bg-[#15191C] p-5">
        <h2 className="text-sm font-semibold text-white">Invited users (pending)</h2>
        <ul className="mt-3 space-y-2">
          {data.invites.length === 0 && <li className="text-sm text-neutral-400">No pending invites.</li>}
          {data.invites.map((inv) => (
            <li key={inv.id} className="rounded border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-neutral-300">
              {inv.email} · Invite Pending · expires {new Date(inv.expiresAt).toLocaleDateString()}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-[#24292E] bg-[#15191C]">
        <div className="grid grid-cols-12 border-b border-[#24292E] bg-neutral-900/40 px-4 py-3 text-xs uppercase tracking-widest text-neutral-500">
          <div className="col-span-4">User</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-4 text-right">Actions</div>
        </div>
        {data.users.map((u) => {
          const expanded = expandedUserId === u.id;
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
                    onChange={(e) =>
                      void setAdminUserRole(u.id, e.target.value as Role)
                        .then(load)
                        .catch((err) => setNotice(toMessage(err, "Could not update role.")))
                    }
                    className="rounded border border-[#24292E] bg-[#1C2126] px-2 py-1 text-xs text-white"
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
                    onClick={() =>
                      void sendAdminUserResetLink(u.id)
                        .then(() => setNotice(`Password reset link sent to ${u.email}.`))
                        .catch((err) => setNotice(toMessage(err, "Could not send reset link.")))
                    }
                    className="rounded border border-[#24292E] bg-[#1C2126] px-2 py-1 text-xs text-white"
                  >
                    Send reset link
                  </button>
                  {u.status === "active" ? (
                    <button
                      type="button"
                      onClick={() =>
                        void deactivateAdminUser(u.id).then(load).catch((err) => setNotice(toMessage(err, "Could not deactivate user.")))
                      }
                      className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-100"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        void reactivateAdminUser(u.id).then(load).catch((err) => setNotice(toMessage(err, "Could not reactivate user.")))
                      }
                      className="rounded border border-brand-lime/35 bg-brand-lime/10 px-2 py-1 text-xs text-brand-lime"
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
                        className="ml-auto rounded bg-brand-lime px-4 py-2 text-xs font-semibold text-canvas disabled:opacity-50"
                      >
                        {savingAccessForUserId === u.id ? "Saving..." : "Save access"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

