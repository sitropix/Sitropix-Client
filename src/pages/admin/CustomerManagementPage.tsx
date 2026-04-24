import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminTriggerPasswordReset,
  fetchAdminSubscriptions,
  fetchAdminUsers,
  updateAdminSubscription,
} from "@/services/subscriptionsApi";
import type { AdminUserRow, Subscription } from "@/types/subscription";

export function CustomerManagementPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const [u, s] = await Promise.all([fetchAdminUsers(), fetchAdminSubscriptions()]);
    setUsers(u);
    setSubs(s);
  }

  useEffect(() => {
    void load().catch(() => setNotice("Could not load directory."));
  }, []);

  const filteredUsers = useMemo(() => {
    if (filter === "all") return users;
    return users.filter((u) => {
      const s = subs.find((x) => x.userId === u.id);
      return s?.status === filter;
    });
  }, [users, subs, filter]);

  const activeCount = subs.filter((s) => s.status === "active").length;
  const totalMrr = subs.reduce((sum, s) => sum + (s.plan?.priceMonthlyCents ?? 0), 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Customer Base</h1>
          <p className="mt-1 text-sm text-neutral-500">Manage and audit global enterprise accounts</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-lg border border-[#24292E] bg-[#15191C] px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500">Active</p>
            <p className="text-xl font-bold text-brand-lime">{activeCount}</p>
          </div>
          <div className="rounded-lg border border-[#24292E] bg-[#15191C] px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500">Total MRR</p>
            <p className="text-xl font-bold text-white">${(totalMrr / 100).toFixed(1)}k</p>
          </div>
        </div>
      </header>

      {notice && (
        <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/90">{notice}</p>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#24292E] bg-[#15191C] p-4">
        <span className="text-xs uppercase text-neutral-500">Filter by:</span>
        {["all", "active", "trialing", "paused", "canceled", "past_due"].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded px-3 py-1.5 text-xs uppercase tracking-wide transition ${
              filter === value ? "bg-brand-lime text-canvas" : "border border-[#24292E] bg-[#1C2126] text-neutral-400 hover:text-white"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-[#24292E] bg-[#15191C]">
        <div className="grid grid-cols-12 border-b border-[#24292E] bg-neutral-900/40 px-4 py-3 text-xs uppercase tracking-widest text-neutral-500">
          <div className="col-span-4">Customer</div>
          <div className="col-span-2">Plan</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-4 text-right">Actions</div>
        </div>
        {filteredUsers.map((u) => {
          const subRow = subs.find((s) => s.userId === u.id);
          return (
            <article
              key={u.id}
              className="grid grid-cols-12 items-center gap-2 border-b border-[#24292E] px-4 py-4 last:border-b-0 hover:bg-[#1C2126]"
            >
              <div className="col-span-4 min-w-0">
                <h3 className="text-sm font-semibold text-white">{u.name}</h3>
                <p className="truncate text-xs text-neutral-400">{u.email}</p>
              </div>
              <div className="col-span-2 text-xs text-neutral-300">{subRow?.plan?.name ?? "—"}</div>
              <div className="col-span-2 text-xs capitalize text-neutral-300">{subRow?.status ?? "none"}</div>
              <div className="col-span-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void adminTriggerPasswordReset(u.id)
                      .then(() => setNotice(`Password reset email queued for ${u.email}.`))
                      .catch(() => setNotice("Could not send reset email."))
                  }
                  className="rounded border border-[#24292E] bg-[#1C2126] px-2.5 py-1 text-xs text-white transition hover:border-brand-lime/35"
                >
                  Reset Password
                </button>
                <Link
                  to={`/admin/users/${u.id}/documents`}
                  state={{ email: u.email }}
                  className="rounded border border-[#24292E] bg-[#1C2126] px-2.5 py-1 text-xs text-white transition hover:border-brand-lime/35"
                >
                  Documents
                </Link>
                {subRow && (
                  <>
                    <button
                      type="button"
                      onClick={() => void updateAdminSubscription(subRow.id, { status: "active" }).then(load)}
                      className="rounded border border-[#24292E] bg-[#1C2126] px-2.5 py-1 text-xs text-white"
                    >
                      Set active
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateAdminSubscription(subRow.id, { status: "canceled" }).then(load)}
                      className="rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-100"
                    >
                      Set canceled
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateAdminSubscription(subRow.id, { extendDays: 7 }).then(load)}
                      className="rounded border border-brand-lime/40 bg-brand-lime/5 px-2.5 py-1 text-xs text-brand-lime"
                    >
                      Extend +7d
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
