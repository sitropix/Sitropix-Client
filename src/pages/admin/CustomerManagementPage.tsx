import { useEffect, useMemo, useState } from "react";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
import { NoModuleAccess } from "@/components/NoModuleAccess";
import { isModuleForbiddenError } from "@/services/http";
import {
  adminTriggerPasswordReset,
  adminUploadClientDocument,
  deactivateAdminCustomer,
  deleteAdminCustomer,
  fetchAdminCustomerDeletePreview,
  fetchAdminCustomerProfile,
  fetchAdminSubscriptions,
  fetchAdminUsers,
  reactivateAdminCustomer,
  updateAdminSubscription,
} from "@/services/subscriptionsApi";
import type { AdminCustomerProfilePayload, AdminUserRow, Subscription } from "@/types/subscription";

type DetailTab = "overview" | "tickets" | "documents" | "transactions";

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function CustomerManagementPage() {
  const { cache, updateCache } = useAdminPrefetch();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<AdminCustomerProfilePayload | null>(null);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [deactivateReason, setDeactivateReason] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("General");
  const [noModuleAccess, setNoModuleAccess] = useState(false);

  async function load() {
    setNoModuleAccess(false);
    const [u, s] = await Promise.all([fetchAdminUsers(), fetchAdminSubscriptions()]);
    setUsers(u);
    setSubs(s);
    updateCache({ users: u, subscriptions: s });
  }

  useEffect(() => {
    if (cache.users) setUsers(cache.users);
    if (cache.subscriptions) setSubs(cache.subscriptions);
    void load().catch((err) => {
      if (isModuleForbiddenError(err)) {
        setNoModuleAccess(true);
        return;
      }
      setNotice("Could not load directory.");
    });
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setProfile(null);
      return;
    }
    void fetchAdminCustomerProfile(selectedUserId)
      .then(setProfile)
      .catch((err) => {
        if (isModuleForbiddenError(err)) {
          setNoModuleAccess(true);
          return;
        }
        setNotice("Could not load customer details.");
      });
  }, [selectedUserId]);

  if (noModuleAccess) {
    return <NoModuleAccess moduleLabel="Customers" />;
  }

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
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedUserId(u.id);
                setTab("overview");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedUserId(u.id);
                  setTab("overview");
                }
              }}
              className="grid grid-cols-12 items-center gap-2 border-b border-[#24292E] px-4 py-4 last:border-b-0 hover:bg-[#1C2126] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-lime/35"
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
                  onClickCapture={(e) => e.stopPropagation()}
                  className="rounded border border-[#24292E] bg-[#1C2126] px-2.5 py-1 text-xs text-white transition hover:border-brand-lime/35"
                >
                  Reset Password
                </button>
                {subRow && (
                  <>
                    <button
                      type="button"
                      onClick={() => void updateAdminSubscription(subRow.id, { status: "active" }).then(load)}
                      onClickCapture={(e) => e.stopPropagation()}
                      className="rounded border border-[#24292E] bg-[#1C2126] px-2.5 py-1 text-xs text-white"
                    >
                      Set active
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateAdminSubscription(subRow.id, { status: "canceled" }).then(load)}
                      onClickCapture={(e) => e.stopPropagation()}
                      className="rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-100"
                    >
                      Set canceled
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateAdminSubscription(subRow.id, { extendDays: 7 }).then(load)}
                      onClickCapture={(e) => e.stopPropagation()}
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

      {selectedUserId && profile && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/65 p-4 pt-16 sm:p-6 sm:pt-20"
          onClick={() => setSelectedUserId(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Customer details"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-[#24292E] bg-[#15191C] p-5 shadow-2xl"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#24292E] pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{profile.overview.user.name}</h2>
                <p className="text-sm text-neutral-400">{profile.overview.user.email}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Joined {new Date(profile.overview.user.createdAt).toLocaleDateString()} ·{" "}
                  {profile.overview.user.isActive ? "Active" : "Deactivated"}
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="text-right">
                  <p className="text-xs uppercase tracking-widest text-neutral-500">Total generated revenue</p>
                  <p className="text-2xl font-bold text-brand-lime">
                    {money(profile.overview.totalGeneratedRevenueCents)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUserId(null)}
                  className="rounded border border-white/15 bg-[#1C2126] px-2.5 py-1 text-xs text-white transition hover:border-brand-lime/35"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(["overview", "tickets", "documents", "transactions"] as DetailTab[]).map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => setTab(x)}
                  className={`rounded-md px-3 py-1.5 text-xs uppercase tracking-wide ${
                    tab === x ? "bg-brand-lime text-canvas" : "border border-[#24292E] bg-[#1C2126] text-neutral-400"
                  }`}
                >
                  {x}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {tab === "overview" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <article className="rounded-lg border border-[#24292E] bg-[#1C2126] p-4">
                    <p className="text-xs uppercase tracking-widest text-neutral-500">Subscription</p>
                    {profile.overview.subscription ? (
                      <div className="mt-2 space-y-1 text-sm text-neutral-300">
                        <p>Plan: {profile.overview.subscription.plan?.name ?? "—"}</p>
                        <p>Status: {profile.overview.subscription.status}</p>
                        <p>
                          Next billing: {fmtDate(profile.overview.subscription.nextBillingDate)} (
                          {profile.overview.subscription.nextBillingAmountCents == null
                            ? "—"
                            : money(profile.overview.subscription.nextBillingAmountCents)}
                          )
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-neutral-400">No active subscription.</p>
                    )}
                  </article>
                  <article className="rounded-lg border border-[#24292E] bg-[#1C2126] p-4">
                    <p className="text-xs uppercase tracking-widest text-neutral-500">Actions</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {profile.overview.user.isActive ? (
                        <button
                          type="button"
                          onClick={() =>
                            void deactivateAdminCustomer(profile.overview.user.id, deactivateReason)
                              .then(async () => {
                                setNotice("Customer deactivated.");
                                await load();
                                setProfile(await fetchAdminCustomerProfile(profile.overview.user.id));
                              })
                              .catch(() => setNotice("Could not deactivate customer."))
                          }
                          className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            void reactivateAdminCustomer(profile.overview.user.id)
                              .then(async () => {
                                setNotice("Customer reactivated.");
                                await load();
                                setProfile(await fetchAdminCustomerProfile(profile.overview.user.id));
                              })
                              .catch(() => setNotice("Could not reactivate customer."))
                          }
                          className="rounded border border-brand-lime/35 bg-brand-lime/10 px-3 py-1.5 text-xs text-brand-lime"
                        >
                          Reactivate
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          void (async () => {
                            try {
                              const preview = await fetchAdminCustomerDeletePreview(profile.overview.user.id);
                              const ok = window.confirm(
                                `Delete ${preview.email}?\nSubscriptions: ${preview.counts.subscriptions}\nPayments: ${preview.counts.payments}\nTickets: ${preview.counts.tickets}\nDocuments: ${preview.counts.documents}\n\nThis cannot be undone.`,
                              );
                              if (!ok) return;
                              const entered = window.prompt(`Type the email to confirm delete:\n${preview.email}`) ?? "";
                              await deleteAdminCustomer(profile.overview.user.id, entered.trim());
                              setNotice("Customer deleted.");
                              setSelectedUserId(null);
                              await load();
                            } catch {
                              setNotice("Delete canceled or failed.");
                            }
                          })()
                        }
                        className="rounded border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-100"
                      >
                        Delete customer
                      </button>
                    </div>
                    <input
                      value={deactivateReason}
                      onChange={(e) => setDeactivateReason(e.target.value)}
                      placeholder="Optional deactivation reason"
                      className="mt-3 w-full rounded border border-[#24292E] bg-[#15191C] px-2.5 py-2 text-xs text-white"
                    />
                  </article>
                </div>
              )}

              {tab === "tickets" && (
                <ul className="space-y-2">
                  {profile.tickets.length === 0 && <li className="text-sm text-neutral-400">No tickets yet.</li>}
                  {profile.tickets.map((t) => (
                    <li key={t.id} className="rounded-lg border border-[#24292E] bg-[#1C2126] px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-white">{t.subject}</p>
                        <p className="text-xs text-neutral-400">{t.status}</p>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        Updated {fmtDate(t.updatedAt)} · {t.department} · {t.threadCount} messages
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {tab === "documents" && (
                <div className="space-y-3">
                  <form
                    className="grid gap-2 rounded-lg border border-[#24292E] bg-[#1C2126] p-3 md:grid-cols-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!selectedUserId || !uploadFile) return;
                      void adminUploadClientDocument(
                        selectedUserId,
                        uploadFile,
                        uploadTitle.trim() || uploadFile.name,
                        uploadCategory.trim() || "General",
                      )
                        .then(async () => {
                          setUploadFile(null);
                          setUploadTitle("");
                          setNotice("Document uploaded.");
                          setProfile(await fetchAdminCustomerProfile(selectedUserId));
                        })
                        .catch(() => setNotice("Could not upload document."));
                    }}
                  >
                    <input
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="Title"
                      className="rounded border border-[#24292E] bg-[#15191C] px-2.5 py-2 text-xs text-white"
                    />
                    <input
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      placeholder="Category"
                      className="rounded border border-[#24292E] bg-[#15191C] px-2.5 py-2 text-xs text-white"
                    />
                    <input
                      type="file"
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                      className="text-xs text-neutral-400 file:mr-2 file:rounded file:border-0 file:bg-brand-lime file:px-2 file:py-1 file:text-canvas"
                    />
                    <button type="submit" className="rounded bg-brand-lime px-3 py-2 text-xs font-semibold text-canvas">
                      Upload
                    </button>
                  </form>
                  <ul className="space-y-2">
                    {profile.documents.length === 0 && <li className="text-sm text-neutral-400">No documents yet.</li>}
                    {profile.documents.map((d) => (
                      <li key={d.id} className="rounded-lg border border-[#24292E] bg-[#1C2126] px-4 py-3 text-sm text-neutral-300">
                        <p className="font-medium text-white">{d.title}</p>
                        <p className="text-xs text-neutral-500">
                          {d.category} · {d.fileName} · {(d.sizeBytes / 1024).toFixed(1)} KB
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {tab === "transactions" && (
                <div className="overflow-hidden rounded-lg border border-[#24292E]">
                  <div className="grid grid-cols-12 bg-[#1C2126] px-3 py-2 text-[11px] uppercase tracking-wide text-neutral-500">
                    <div className="col-span-3">Invoice ID</div>
                    <div className="col-span-2">Mode</div>
                    <div className="col-span-2">Amount</div>
                    <div className="col-span-3">Next billing</div>
                    <div className="col-span-2">Status</div>
                  </div>
                  {profile.transactions.length === 0 && <p className="px-3 py-3 text-sm text-neutral-400">No transactions.</p>}
                  {profile.transactions.map((tx) => (
                    <div key={tx.id} className="grid grid-cols-12 border-t border-[#24292E] px-3 py-2 text-xs text-neutral-300">
                      <div className="col-span-3 font-mono text-white/80">{tx.invoiceNumber}</div>
                      <div className="col-span-2">{tx.paymentMode}</div>
                      <div className="col-span-2">{money(tx.amountCents, tx.currency)}</div>
                      <div className="col-span-3">
                        {tx.nextBillingAmountCents == null ? "—" : money(tx.nextBillingAmountCents, tx.currency)}
                      </div>
                      <div className="col-span-2 capitalize">{tx.status.replace("_", " ")}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
