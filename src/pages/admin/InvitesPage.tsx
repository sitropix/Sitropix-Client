import { FormEvent, useEffect, useState } from "react";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
import {
  createAdminInvite,
  fetchAdminInvites,
  fetchAdminPlans,
  resendAdminInvite,
  revokeAdminInvite,
} from "@/services/subscriptionsApi";
import type { AdminInviteRow, Plan } from "@/types/subscription";
import { SxBadge } from "@/components/sx/Badge";
import { SxButton } from "@/components/sx/Button";
import { SxConfirmDialog } from "@/components/sx/ConfirmDialog";
import { SxEmptyState } from "@/components/sx/EmptyState";
import { SxInput, SxSelect, SxTextarea } from "@/components/sx/Input";
import { SxPanel } from "@/components/sx/Panel";
import { useSxToast } from "@/components/sx/Toast";

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusOf(row: AdminInviteRow): {
  variant:
    | "open"
    | "progress"
    | "review"
    | "resolved"
    | "closed"
    | "urgent"
    | "success"
    | "info"
    | "warning"
    | "danger"
    | "neutral"
    | "brand";
  label: string;
} {
  if (row.revokedAt) return { variant: "closed", label: "Revoked" };
  if (row.acceptedAt) return { variant: "success", label: "Accepted" };
  if (row.expiresAt && new Date(row.expiresAt) < new Date())
    return { variant: "warning", label: "Expired" };
  return { variant: "info", label: "Pending" };
}

export function InvitesPage() {
  const { cache, updateCache } = useAdminPrefetch();
  const toast = useSxToast();
  const [invites, setInvites] = useState<AdminInviteRow[]>(cache.invites ?? []);
  const [loading, setLoading] = useState(!cache.invites);
  const [plans, setPlans] = useState<Plan[]>(cache.plans ?? []);

  const [email, setEmail] = useState("");
  const [planId, setPlanId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("14");
  const [creating, setCreating] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  async function reload() {
    try {
      const rows = await fetchAdminInvites();
      setInvites(rows);
      updateCache({ invites: rows });
    } catch {
      toast.error("Couldn't load invites.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    if (plans.length === 0) {
      void fetchAdminPlans()
        .then((rows) => {
          setPlans(rows);
          updateCache({ plans: rows });
        })
        .catch(() => {
          /* non-fatal */
        });
    }
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.warning("Add an email first.");
      return;
    }
    setCreating(true);
    try {
      await createAdminInvite({
        email: email.trim(),
        planId: planId || undefined,
        message: message.trim() || undefined,
        expiresInDays: Number(expiresInDays) || undefined,
      });
      toast.success("Invite sent.", `An email is on its way to ${email.trim()}.`);
      setEmail("");
      setMessage("");
      await reload();
    } catch (err) {
      toast.error(
        "Couldn't send invite.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setCreating(false);
    }
  }

  async function onResend(id: string) {
    setBusyId(id);
    try {
      await resendAdminInvite(id);
      toast.success("Invite resent.");
      await reload();
    } catch (err) {
      toast.error(
        "Couldn't resend invite.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onRevoke() {
    if (!revokeId) return;
    setBusyId(revokeId);
    try {
      await revokeAdminInvite(revokeId);
      toast.success("Invite revoked.");
      setRevokeId(null);
      await reload();
    } catch (err) {
      toast.error(
        "Couldn't revoke invite.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b border-[var(--border-subtle)] pb-4">
        <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          Onboarding
        </p>
        <h1 className="mt-1.5 font-ui text-sx-xl font-semibold text-[var(--text-primary)]">
          Customer invites
        </h1>
        <p className="mt-1 text-sx-sm text-[var(--text-secondary)]">
          Send signup links to new customers with an optional plan pre-attached.
        </p>
      </header>

      <SxPanel title="New invite">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => void onCreate(e)}
        >
          <SxInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alex@northstardental.com"
            required
          />
          <SxSelect
            label="Plan (optional)"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
          >
            <option value="">No plan attached</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SxSelect>
          <SxInput
            label="Expires in (days)"
            type="number"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
            min={1}
            max={90}
          />
          <SxTextarea
            label="Message (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Welcome to Sitropix — set up your account whenever you're ready."
            containerClassName="sm:col-span-2"
            rows={3}
          />
          <div className="sm:col-span-2">
            <SxButton type="submit" loading={creating}>
              Send invite
            </SxButton>
          </div>
        </form>
      </SxPanel>

      <SxPanel title={`Invites (${invites.length})`} padded={false}>
        {loading ? (
          <p className="p-5 text-sx-sm text-[var(--text-tertiary)]">Loading…</p>
        ) : invites.length === 0 ? (
          <div className="p-5">
            <SxEmptyState
              title="No invites yet."
              description="Send one above to add a new customer to the portal."
            />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {invites.map((row) => {
              const s = statusOf(row);
              const isBusy = busyId === row.id;
              const showResend = !row.acceptedAt && !row.revokedAt;
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-ui text-sx-sm font-semibold text-[var(--text-primary)]">
                        {row.email}
                      </p>
                      <SxBadge variant={s.variant}>{s.label}</SxBadge>
                      {row.plan ? (
                        <SxBadge variant="brand" withDot={false}>
                          {row.plan.name}
                        </SxBadge>
                      ) : null}
                    </div>
                    <p className="mt-1 font-mono text-sx-2xs text-[var(--text-tertiary)]">
                      Created {formatDate(row.createdAt)} · Expires{" "}
                      {formatDate(row.expiresAt)}
                      {(row.resendCount ?? 0) > 0
                        ? ` · ${row.resendCount} resends`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {showResend ? (
                      <SxButton
                        variant="secondary"
                        size="sm"
                        loading={isBusy}
                        onClick={() => void onResend(row.id)}
                      >
                        Resend
                      </SxButton>
                    ) : null}
                    {!row.revokedAt && !row.acceptedAt ? (
                      <SxButton
                        variant="ghost"
                        size="sm"
                        className="!text-[var(--color-danger-fg)]"
                        onClick={() => setRevokeId(row.id)}
                      >
                        Revoke
                      </SxButton>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SxPanel>

      <SxConfirmDialog
        open={revokeId !== null}
        title="Revoke this invite?"
        body="The link stops working immediately. You can send a fresh invite to the same email later."
        confirmLabel="Revoke"
        destructive
        loading={busyId === revokeId}
        onConfirm={() => void onRevoke()}
        onCancel={() => setRevokeId(null)}
      />
    </div>
  );
}
