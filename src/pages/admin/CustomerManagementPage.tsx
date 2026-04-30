import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
import { NoModuleAccess } from "@/components/NoModuleAccess";
import { ConfirmDialog, DeleteConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { isModuleForbiddenError } from "@/services/http";
import {
  adminTriggerCustomerPasswordReset,
  adminUploadClientDocument,
  deactivateAdminCustomer,
  deleteAdminCustomer,
  fetchAdminCustomerDeletePreview,
  fetchAdminCustomerProfile,
  fetchAdminSubscriptions,
  fetchAdminUsers,
  reactivateAdminCustomer,
  syncAdminCustomerStripe,
  updateAdminSubscription,
} from "@/services/subscriptionsApi";
import type { AdminCustomerProfilePayload, AdminUserRow, Subscription } from "@/types/subscription";

type DetailTab = "overview" | "tickets" | "documents" | "transactions";

const PAGE_SIZE = 5;
const CUSTOMERS_PAGE_SIZE = 10;

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function CustomerManagementPage() {
  const { cache, updateCache } = useAdminPrefetch();
  const { showSuccess, showError } = useToast();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<AdminCustomerProfilePayload | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [deactivateReason, setDeactivateReason] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("General");
  const [noModuleAccess, setNoModuleAccess] = useState(false);
  const [ticketsPage, setTicketsPage] = useState(1);
  const [docsPage, setDocsPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const [customersPage, setCustomersPage] = useState(1);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    email: string;
    userId: string;
    counts: { subscriptions: number; payments: number; tickets: number; documents: number };
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deactivateDialog, setDeactivateDialog] = useState<{ open: boolean; userId: string; userName: string; isActive: boolean } | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

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
      showError("Could not load directory.");
    });
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    setTicketsPage(1);
    setDocsPage(1);
    setTxPage(1);
    void fetchAdminCustomerProfile(selectedUserId)
      .then(setProfile)
      .catch((err) => {
        if (isModuleForbiddenError(err)) {
          setNoModuleAccess(true);
          return;
        }
        showError("Could not load customer details.");
      })
      .finally(() => setProfileLoading(false));
  }, [selectedUserId]);

  const filteredUsers = useMemo(() => {
    if (filter === "all") return users;
    return users.filter((u) => {
      const s = subs.find((x) => x.userId === u.id);
      return s?.status === filter;
    });
  }, [users, subs, filter]);

  const totalCustomersPages = Math.ceil(filteredUsers.length / CUSTOMERS_PAGE_SIZE);
  const paginatedUsers = filteredUsers.slice(
    (customersPage - 1) * CUSTOMERS_PAGE_SIZE,
    customersPage * CUSTOMERS_PAGE_SIZE
  );

  useEffect(() => {
    setCustomersPage(1);
  }, [filter]);

  if (noModuleAccess) {
    return <NoModuleAccess moduleLabel="Customers" />;
  }

  const activeCount = subs.filter((s) => s.status === "active").length;
  const totalMrr = subs.reduce((sum, s) => sum + (s.plan?.priceMonthlyCents ?? 0), 0);

  async function handleDeleteCustomer(confirmEmail: string) {
    if (!deleteDialog) return;
    setDeleteLoading(true);
    try {
      await deleteAdminCustomer(deleteDialog.userId, confirmEmail);
      showSuccess("Customer deleted successfully.");
      setSelectedUserId(null);
      setDeleteDialog(null);
      await load();
    } catch {
      showError("Delete failed. Make sure the email matches exactly.");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleDeactivateReactivate() {
    if (!deactivateDialog) return;
    setActionLoading((prev) => ({ ...prev, [deactivateDialog.userId]: true }));
    try {
      if (deactivateDialog.isActive) {
        await deactivateAdminCustomer(deactivateDialog.userId, deactivateReason);
        showSuccess("Customer deactivated successfully.");
      } else {
        await reactivateAdminCustomer(deactivateDialog.userId);
        showSuccess("Customer reactivated successfully.");
      }
      await load();
      if (selectedUserId === deactivateDialog.userId) {
        setProfile(await fetchAdminCustomerProfile(deactivateDialog.userId));
      }
      setDeactivateDialog(null);
    } catch {
      showError(deactivateDialog.isActive ? "Could not deactivate customer." : "Could not reactivate customer.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [deactivateDialog.userId]: false }));
    }
  }

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
        {paginatedUsers.length === 0 && (
          <p className="px-4 py-6 text-sm text-neutral-400">No customers found.</p>
        )}
        {paginatedUsers.map((u) => {
          const subRow = subs.find((s) => s.userId === u.id);
          const isLoading = actionLoading[u.id];
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
                  disabled={isLoading}
                  onClick={() => {
                    setActionLoading((prev) => ({ ...prev, [u.id]: true }));
                    void adminTriggerCustomerPasswordReset(u.id)
                      .then(() => showSuccess(`Password reset email queued for ${u.email}.`))
                      .catch(() => showError("Could not send reset email."))
                      .finally(() => setActionLoading((prev) => ({ ...prev, [u.id]: false })));
                  }}
                  onClickCapture={(e) => e.stopPropagation()}
                  className="rounded border border-[#24292E] bg-[#1C2126] px-2.5 py-1 text-xs text-white transition hover:border-brand-lime/35 disabled:opacity-50"
                >
                  {isLoading ? "..." : "Reset Password"}
                </button>
                {subRow && (
                  <>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => {
                        setActionLoading((prev) => ({ ...prev, [u.id]: true }));
                        void updateAdminSubscription(subRow.id, { status: "active" })
                          .then(async () => {
                            showSuccess(`Subscription set to active for ${u.email}.`);
                            await load();
                            if (selectedUserId === u.id) {
                              setProfile(await fetchAdminCustomerProfile(u.id));
                            }
                          })
                          .catch(() => showError("Could not set subscription to active."))
                          .finally(() => setActionLoading((prev) => ({ ...prev, [u.id]: false })));
                      }}
                      onClickCapture={(e) => e.stopPropagation()}
                      className="rounded border border-[#24292E] bg-[#1C2126] px-2.5 py-1 text-xs text-white disabled:opacity-50"
                    >
                      Set active
                    </button>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => {
                        setActionLoading((prev) => ({ ...prev, [u.id]: true }));
                        void updateAdminSubscription(subRow.id, { status: "canceled" })
                          .then(async () => {
                            showSuccess(`Subscription set to canceled for ${u.email}.`);
                            await load();
                            if (selectedUserId === u.id) {
                              setProfile(await fetchAdminCustomerProfile(u.id));
                            }
                          })
                          .catch(() => showError("Could not set subscription to canceled."))
                          .finally(() => setActionLoading((prev) => ({ ...prev, [u.id]: false })));
                      }}
                      onClickCapture={(e) => e.stopPropagation()}
                      className="rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-100 disabled:opacity-50"
                    >
                      Set canceled
                    </button>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => {
                        setActionLoading((prev) => ({ ...prev, [u.id]: true }));
                        void updateAdminSubscription(subRow.id, { extendDays: 7 })
                          .then(async () => {
                            showSuccess(`Extended subscription by 7 days for ${u.email}.`);
                            await load();
                            if (selectedUserId === u.id) {
                              setProfile(await fetchAdminCustomerProfile(u.id));
                            }
                          })
                          .catch(() => showError("Could not extend subscription by 7 days."))
                          .finally(() => setActionLoading((prev) => ({ ...prev, [u.id]: false })));
                      }}
                      onClickCapture={(e) => e.stopPropagation()}
                      className="rounded border border-brand-lime/40 bg-brand-lime/5 px-2.5 py-1 text-xs text-brand-lime disabled:opacity-50"
                    >
                      Extend +7d
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
        {filteredUsers.length > CUSTOMERS_PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-[#24292E] px-4 py-3">
            <p className="text-xs text-neutral-500">
              Page {customersPage} of {totalCustomersPages} ({filteredUsers.length} total)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={customersPage === 1}
                onClick={() => setCustomersPage((p) => p - 1)}
                className="rounded border border-[#24292E] bg-[#1C2126] px-3 py-1.5 text-xs text-white disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={customersPage >= totalCustomersPages}
                onClick={() => setCustomersPage((p) => p + 1)}
                className="rounded border border-[#24292E] bg-[#1C2126] px-3 py-1.5 text-xs text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {selectedUserId && (
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
            {profileLoading && (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-lime border-t-transparent" />
                  <p className="text-sm text-neutral-400">Loading customer data...</p>
                </div>
              </div>
            )}
            {!profileLoading && profile && (
              <>
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
                          disabled={actionLoading[profile.overview.user.id]}
                          onClick={() =>
                            setDeactivateDialog({
                              open: true,
                              userId: profile.overview.user.id,
                              userName: profile.overview.user.name,
                              isActive: true,
                            })
                          }
                          className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100 disabled:opacity-50"
                        >
                          {actionLoading[profile.overview.user.id] ? "..." : "Deactivate"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={actionLoading[profile.overview.user.id]}
                          onClick={() =>
                            setDeactivateDialog({
                              open: true,
                              userId: profile.overview.user.id,
                              userName: profile.overview.user.name,
                              isActive: false,
                            })
                          }
                          className="rounded border border-brand-lime/35 bg-brand-lime/10 px-3 py-1.5 text-xs text-brand-lime disabled:opacity-50"
                        >
                          {actionLoading[profile.overview.user.id] ? "..." : "Reactivate"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={deleteLoading}
                        onClick={() =>
                          void (async () => {
                            try {
                              const preview = await fetchAdminCustomerDeletePreview(profile.overview.user.id);
                              setDeleteDialog({
                                open: true,
                                email: preview.email,
                                userId: profile.overview.user.id,
                                counts: preview.counts,
                              });
                            } catch {
                              showError("Could not load delete preview.");
                            }
                          })()
                        }
                        className="rounded border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-100 disabled:opacity-50"
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
                <div className="space-y-3">
                  {profile.tickets.length === 0 && <p className="text-sm text-neutral-400">No tickets yet.</p>}
                  <ul className="space-y-2">
                    {profile.tickets.slice((ticketsPage - 1) * PAGE_SIZE, ticketsPage * PAGE_SIZE).map((t) => (
                      <li key={t.id} className="rounded-lg border border-[#24292E] bg-[#1C2126] px-4 py-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-white">{t.subject}</p>
                            <p className="mt-1 text-xs text-neutral-500">
                              Updated {fmtDate(t.updatedAt)} · {t.department} · {t.threadCount} messages
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {(() => {
                              const ticketStatusClass: Record<string, string> = {
                                open: "bg-amber-500/20 text-amber-300",
                                in_progress: "bg-blue-500/20 text-blue-300",
                                hold: "bg-violet-500/20 text-violet-300",
                                resolved: "bg-green-500/20 text-green-300",
                              };
                              const statusClass = ticketStatusClass[t.status] ?? "bg-neutral-500/20 text-neutral-300";
                              return (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}
                            >
                              {t.status.replace("_", " ")}
                            </span>
                              );
                            })()}
                            <Link
                              to={`/admin/tickets/${t.id}`}
                              className="rounded border border-brand-lime/40 bg-brand-lime/10 px-3 py-1.5 text-xs font-medium text-brand-lime transition hover:bg-brand-lime/20"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Open
                            </Link>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {profile.tickets.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-neutral-500">
                        Page {ticketsPage} of {Math.ceil(profile.tickets.length / PAGE_SIZE)} ({profile.tickets.length} total)
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={ticketsPage === 1}
                          onClick={() => setTicketsPage((p) => p - 1)}
                          className="rounded border border-[#24292E] bg-[#1C2126] px-3 py-1.5 text-xs text-white disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          disabled={ticketsPage >= Math.ceil(profile.tickets.length / PAGE_SIZE)}
                          onClick={() => setTicketsPage((p) => p + 1)}
                          className="rounded border border-[#24292E] bg-[#1C2126] px-3 py-1.5 text-xs text-white disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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
                          showSuccess("Document uploaded successfully.");
                          setProfile(await fetchAdminCustomerProfile(selectedUserId));
                          setDocsPage(1);
                        })
                        .catch(() => showError("Could not upload document."));
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
                  {profile.documents.length === 0 && <p className="text-sm text-neutral-400">No documents yet.</p>}
                  <ul className="space-y-2">
                    {profile.documents.slice((docsPage - 1) * PAGE_SIZE, docsPage * PAGE_SIZE).map((d) => (
                      <li key={d.id} className="rounded-lg border border-[#24292E] bg-[#1C2126] px-4 py-3 text-sm text-neutral-300">
                        <p className="font-medium text-white">{d.title}</p>
                        <p className="text-xs text-neutral-500">
                          {d.category} · {d.fileName} · {(d.sizeBytes / 1024).toFixed(1)} KB
                        </p>
                      </li>
                    ))}
                  </ul>
                  {profile.documents.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-neutral-500">
                        Page {docsPage} of {Math.ceil(profile.documents.length / PAGE_SIZE)} ({profile.documents.length} total)
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={docsPage === 1}
                          onClick={() => setDocsPage((p) => p - 1)}
                          className="rounded border border-[#24292E] bg-[#1C2126] px-3 py-1.5 text-xs text-white disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          disabled={docsPage >= Math.ceil(profile.documents.length / PAGE_SIZE)}
                          onClick={() => setDocsPage((p) => p + 1)}
                          className="rounded border border-[#24292E] bg-[#1C2126] px-3 py-1.5 text-xs text-white disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === "transactions" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-neutral-500">
                      {profile.transactions.length} transaction{profile.transactions.length !== 1 ? "s" : ""}
                    </p>
                    <button
                      type="button"
                      disabled={actionLoading[`sync_${profile.overview.user.id}`]}
                      onClick={async () => {
                        setActionLoading((prev) => ({ ...prev, [`sync_${profile.overview.user.id}`]: true }));
                        try {
                          const result = await syncAdminCustomerStripe(profile.overview.user.id);
                          if (result.ok) {
                            showSuccess("Synced from Stripe successfully.");
                            setProfile(await fetchAdminCustomerProfile(profile.overview.user.id));
                          } else {
                            showError(`Sync failed: ${result.reason || "Unknown error"}`);
                          }
                        } catch {
                          showError("Could not sync from Stripe.");
                        } finally {
                          setActionLoading((prev) => ({ ...prev, [`sync_${profile.overview.user.id}`]: false }));
                        }
                      }}
                      className="flex items-center gap-1.5 rounded border border-brand-lime/40 bg-brand-lime/10 px-3 py-1.5 text-xs font-medium text-brand-lime transition hover:bg-brand-lime/20 disabled:opacity-50"
                    >
                      {actionLoading[`sync_${profile.overview.user.id}`] ? (
                        <>
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-lime border-t-transparent" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Sync from Stripe
                        </>
                      )}
                    </button>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-[#24292E]">
                    <div className="grid grid-cols-12 bg-[#1C2126] px-3 py-2 text-[11px] uppercase tracking-wide text-neutral-500">
                      <div className="col-span-3">Invoice ID</div>
                      <div className="col-span-2">Mode</div>
                      <div className="col-span-2">Amount</div>
                      <div className="col-span-3">Next billing</div>
                      <div className="col-span-2">Status</div>
                    </div>
                    {profile.transactions.length === 0 && <p className="px-3 py-3 text-sm text-neutral-400">No transactions. Click "Sync from Stripe" to fetch invoices.</p>}
                    {profile.transactions.slice((txPage - 1) * PAGE_SIZE, txPage * PAGE_SIZE).map((tx) => (
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
                  {profile.transactions.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-neutral-500">
                        Page {txPage} of {Math.ceil(profile.transactions.length / PAGE_SIZE)} ({profile.transactions.length} total)
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={txPage === 1}
                          onClick={() => setTxPage((p) => p - 1)}
                          className="rounded border border-[#24292E] bg-[#1C2126] px-3 py-1.5 text-xs text-white disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          disabled={txPage >= Math.ceil(profile.transactions.length / PAGE_SIZE)}
                          onClick={() => setTxPage((p) => p + 1)}
                          className="rounded border border-[#24292E] bg-[#1C2126] px-3 py-1.5 text-xs text-white disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
              </>
            )}
          </section>
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteDialog?.open ?? false}
        title="Delete customer"
        itemName={deleteDialog?.email ?? ""}
        itemType="customer"
        details={
          deleteDialog
            ? [
                { label: "Subscriptions", value: deleteDialog.counts.subscriptions },
                { label: "Payments", value: deleteDialog.counts.payments },
                { label: "Tickets", value: deleteDialog.counts.tickets },
                { label: "Documents", value: deleteDialog.counts.documents },
              ]
            : []
        }
        confirmText={deleteDialog?.email}
        loading={deleteLoading}
        onConfirm={handleDeleteCustomer}
        onCancel={() => setDeleteDialog(null)}
      />

      <ConfirmDialog
        open={deactivateDialog?.open ?? false}
        title={deactivateDialog?.isActive ? "Deactivate customer" : "Reactivate customer"}
        description={
          deactivateDialog?.isActive
            ? `Are you sure you want to deactivate ${deactivateDialog?.userName}? They will lose access to the portal.`
            : `Are you sure you want to reactivate ${deactivateDialog?.userName}? They will regain access to the portal.`
        }
        confirmLabel={deactivateDialog?.isActive ? "Deactivate" : "Reactivate"}
        variant={deactivateDialog?.isActive ? "warning" : "default"}
        loading={actionLoading[deactivateDialog?.userId ?? ""] ?? false}
        onConfirm={handleDeactivateReactivate}
        onCancel={() => setDeactivateDialog(null)}
      />
    </div>
  );
}
