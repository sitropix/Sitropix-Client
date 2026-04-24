import { FormEvent, useEffect, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { createAdminInvite, fetchAdminInvites, fetchAdminPlans, revokeAdminInvite } from "@/services/subscriptionsApi";
import type { AdminInviteRow, Plan } from "@/types/subscription";

export function InvitesPage() {
  const [invites, setInvites] = useState<AdminInviteRow[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [email, setEmail] = useState("");
  const [planId, setPlanId] = useState("");
  const [message, setMessage] = useState("");
  const [expiresDays, setExpiresDays] = useState("14");
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const [i, p] = await Promise.all([fetchAdminInvites(), fetchAdminPlans()]);
    setInvites(i);
    setPlans(p);
  }

  useEffect(() => {
    void load().catch(() => setNotice("Could not load invites."));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (!email.trim()) return;
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
      setNotice("Invite email sent.");
      await load();
    } catch {
      setNotice("Could not create invite.");
    }
  }

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Admin" }, { label: "Invites" }]} />
      <header>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Customer invites</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Send a secure signup link by email. Optional plan pre-assigns a trial subscription after they register with the same email.
        </p>
      </header>

      {notice && <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/90">{notice}</p>}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-sm font-semibold text-white">New invite</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onCreate}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Recipient email"
            type="email"
            required
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
          />
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
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
            placeholder="Expires in days (1–90)"
            type="number"
            min={1}
            max={90}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Custom onboarding message (optional)"
            rows={3}
            className="md:col-span-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
          />
          <button
            type="submit"
            className="rounded-full bg-brand-lime px-5 py-2.5 text-sm font-semibold text-canvas transition hover:bg-brand-lime-dim md:col-span-2"
          >
            Send invite email
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-sm font-semibold text-white">Recent invites</h2>
        <ul className="mt-4 space-y-2">
          {invites.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-white">{inv.email}</p>
                <p className="text-xs text-ink-muted">
                  {inv.plan?.name ?? "No plan"} · {inv.acceptedAt ? "Accepted" : inv.revokedAt ? "Revoked" : "Pending"} · expires{" "}
                  {new Date(inv.expiresAt).toLocaleDateString()}
                </p>
              </div>
              {!inv.acceptedAt && !inv.revokedAt && (
                <button
                  type="button"
                  onClick={() => void revokeAdminInvite(inv.id).then(load)}
                  className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-100"
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
