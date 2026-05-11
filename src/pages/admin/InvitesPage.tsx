import { FormEvent, useEffect, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
import { NoModuleAccess } from "@/components/NoModuleAccess";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { isModuleForbiddenError } from "@/services/http";
import {
  createAdminInvite,
  fetchAdminInvites,
  fetchAdminPlans,
  resendAdminInvite,
  revokeAdminInvite,
} from "@/services/subscriptionsApi";
import type { AdminInviteRow, Plan } from "@/types/subscription";
import { useAuth } from "@/context/AuthContext";

const INVITES_PAGE_SIZE = 10;

export function InvitesPage() {
  const { cache, updateCache } = useAdminPrefetch();
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();
  const isMasterAdmin = user?.role === "master_admin";
  const [invites, setInvites] = useState<AdminInviteRow[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [email, setEmail] = useState("");
  const [planId, setPlanId] = useState("");
  const [message, setMessage] = useState("");
  const [expiresDays, setExpiresDays] = useState("14");
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [noModuleAccess, setNoModuleAccess] = useState(false);
  const [invitesPage, setInvitesPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState<{ open: boolean; invite: AdminInviteRow | null }>({ open: false, invite: null });

  async function load() {
    setNoModuleAccess(false);
    const [i, p] = await Promise.all([fetchAdminInvites(), fetchAdminPlans()]);
    setInvites(i);
    setPlans(p);
    updateCache({ invites: i, plans: p });
  }

  useEffect(() => {
    if (cache.invites) setInvites(cache.invites);
    if (cache.plans) setPlans(cache.plans);
    void load().catch((err) => {
      if (isModuleForbiddenError(err)) {
        setNoModuleAccess(true);
        return;
      }
      showError("Could not load invites.");
    });
  }, []);

  if (noModuleAccess) {
    return <NoModuleAccess moduleLabel="Invites" />;
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!isMasterAdmin) return;
    if (!email.trim()) return;
    setCreating(true);
    try {
      await createAdminInvite({
        email: email.trim(),
        planId: planId || undefined,
        message: message.trim() || undefined,
        expiresInDays: Math.min(90, Math.max(1, parseInt(expiresDays, 10) || 14)),
      });
      setEmail("");
      setMessage("");
      setPlanId("");
      showSuccess("Invite email sent successfully.");
      setInvitesPage(1);
      await load();
    } catch {
      showError("Could not create invite. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevokeInvite() {
    if (!revokeConfirm.invite) return;
    setBusyInviteId(revokeConfirm.invite.id);
    try {
      await revokeAdminInvite(revokeConfirm.invite.id);
      showSuccess("Invite revoked successfully.");
      setRevokeConfirm({ open: false, invite: null });
      await load();
    } catch {
      showError("Could not revoke invite. Please try again.");
    } finally {
      setBusyInviteId(null);
    }
  }

  const totalInvitesPages = Math.ceil(invites.length / INVITES_PAGE_SIZE);
  const paginatedInvites = invites.slice(
    (invitesPage - 1) * INVITES_PAGE_SIZE,
    invitesPage * INVITES_PAGE_SIZE
  );

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Admin" }, { label: "Invites" }]} />
      <header>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Customer invites</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Send a secure signup link by email. Optional plan pre-assigns a trial subscription after they register with the same email.
        </p>
        {!isMasterAdmin && (
          <p className="mt-2 text-xs text-amber-300">
            Read-only mode: only master admins can create, resend, or revoke invites.
          </p>
        )}
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-sm font-semibold text-white">New invite</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onCreate}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!isMasterAdmin}
            placeholder="Recipient email"
            type="email"
            required
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
          />
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            disabled={!isMasterAdmin}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
          >
            <option value="">No pre-assigned plan</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            value={expiresDays}
            onChange={(e) => setExpiresDays(e.target.value)}
            disabled={!isMasterAdmin}
            placeholder="Expires in days (1–90)"
            type="number"
            min={1}
            max={90}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={!isMasterAdmin}
            placeholder="Custom onboarding message (optional)"
            rows={3}
            className="md:col-span-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
          />
          <button
            type="submit"
            disabled={creating || !isMasterAdmin}
            className="flex items-center justify-center gap-2 rounded-full bg-brand-lime px-5 py-2.5 text-sm font-semibold text-canvas transition hover:bg-brand-lime-dim disabled:opacity-50 md:col-span-2"
          >
            {creating && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
            {creating ? "Sending..." : "Send invite email"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-sm font-semibold text-white">Recent invites</h2>
        {invites.length === 0 && <p className="mt-4 text-sm text-ink-muted">No invites yet.</p>}
        <ul className="mt-4 space-y-2">
          {paginatedInvites.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-white">{inv.email}</p>
                <p className="text-xs text-ink-muted">
                  {inv.plan?.name ?? "No plan"} ·{" "}
                  <span
                    className={
                      inv.acceptedAt
                        ? "text-green-400"
                        : inv.revokedAt
                          ? "text-neutral-500"
                          : "text-amber-400"
                    }
                  >
                    {inv.acceptedAt ? "Accepted" : inv.revokedAt ? "Revoked" : "Pending"}
                  </span>{" "}
                  · expires {new Date(inv.expiresAt).toLocaleDateString()}
                  {typeof inv.resendCount === "number" ? ` · resent ${inv.resendCount}x` : ""}
                  {inv.lastSentAt ? ` · last sent ${new Date(inv.lastSentAt).toLocaleDateString()}` : ""}
                </p>
              </div>
              {!inv.acceptedAt && !inv.revokedAt && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyInviteId === inv.id || !isMasterAdmin}
                    onClick={() =>
                      void (async () => {
                        if (!isMasterAdmin) return;
                        setBusyInviteId(inv.id);
                        try {
                          await resendAdminInvite(inv.id);
                          showSuccess(`Invite re-sent to ${inv.email}.`);
                        } catch {
                          showError("Could not resend invite. Please try again.");
                        } finally {
                          setBusyInviteId(null);
                        }
                      })()
                    }
                    className="flex items-center gap-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white disabled:opacity-40"
                  >
                    {busyInviteId === inv.id && (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    )}
                    {busyInviteId === inv.id ? "Resending..." : "Resend"}
                  </button>
                  <button
                    type="button"
                    disabled={busyInviteId === inv.id || !isMasterAdmin}
                    onClick={() => setRevokeConfirm({ open: true, invite: inv })}
                    className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-100 disabled:opacity-40"
                  >
                    Revoke
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {invites.length > INVITES_PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-ink-muted">
              Page {invitesPage} of {totalInvitesPages} ({invites.length} total)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={invitesPage === 1}
                onClick={() => setInvitesPage((p) => p - 1)}
                className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={invitesPage >= totalInvitesPages}
                onClick={() => setInvitesPage((p) => p + 1)}
                className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={revokeConfirm.open}
        title="Revoke invite"
        description={
          <>
            Are you sure you want to revoke the invitation for{" "}
            <span className="font-semibold text-white">{revokeConfirm.invite?.email}</span>?
            They will no longer be able to use this invite link to sign up.
          </>
        }
        confirmLabel="Revoke invite"
        variant="warning"
        loading={busyInviteId !== null}
        onConfirm={() => void handleRevokeInvite()}
        onCancel={() => setRevokeConfirm({ open: false, invite: null })}
      />
    </div>
  );
}
