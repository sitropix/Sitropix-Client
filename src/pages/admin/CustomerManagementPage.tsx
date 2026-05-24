import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
import { isModuleForbiddenError } from "@/services/http";
import { NoModuleAccess } from "@/components/NoModuleAccess";
import {
  adminTriggerCustomerPasswordReset,
  deactivateAdminCustomer,
  deleteAdminCustomer,
  fetchAdminCustomerDeletePreview,
  fetchAdminCustomerProfile,
  fetchAdminSubscriptions,
  fetchAdminUsers,
  reactivateAdminCustomer,
  syncAdminCustomerStripe,
} from "@/services/subscriptionsApi";
import type {
  AdminCustomerProfilePayload,
  AdminUserRow,
  Subscription,
} from "@/types/subscription";
import { SxBadge } from "@/components/sx/Badge";
import { SxButton } from "@/components/sx/Button";
import { SxConfirmDialog } from "@/components/sx/ConfirmDialog";
import { SxEmptyState } from "@/components/sx/EmptyState";
import { SxInput } from "@/components/sx/Input";
import { SxPanel } from "@/components/sx/Panel";
import { SxSegmentedControl } from "@/components/sx/SegmentedControl";
import { useSxToast } from "@/components/sx/Toast";

type StatusFilter = "all" | "active" | "trialing" | "paused" | "canceled" | "past_due";
type DetailTab = "overview" | "tickets" | "documents" | "transactions";

const PAGE_SIZE = 12;

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
    cents / 100,
  );
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

function subscriptionBadge(status: string) {
  if (status === "active" || status === "trialing")
    return <SxBadge variant="success">{status}</SxBadge>;
  if (status === "past_due") return <SxBadge variant="warning">Past due</SxBadge>;
  if (status === "paused") return <SxBadge variant="warning">Paused</SxBadge>;
  if (status === "canceled") return <SxBadge variant="closed">Canceled</SxBadge>;
  return <SxBadge variant="neutral">{status}</SxBadge>;
}

export function CustomerManagementPage() {
  const { cache, updateCache } = useAdminPrefetch();
  const toast = useSxToast();
  const [users, setUsers] = useState<AdminUserRow[]>(cache.users ?? []);
  const [subs, setSubs] = useState<Subscription[]>(cache.subscriptions ?? []);
  const [loading, setLoading] = useState(!cache.users);
  const [noModuleAccess, setNoModuleAccess] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<AdminCustomerProfilePayload | null>(
    null,
  );
  const [profileLoading, setProfileLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");

  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});
  const [deleteOpen, setDeleteOpen] = useState<{
    userId: string;
    email: string;
    counts: {
      subscriptions: number;
      payments: number;
      tickets: number;
      documents: number;
    };
  } | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState<{
    userId: string;
    name: string;
    isActive: boolean;
  } | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [deactivateBusy, setDeactivateBusy] = useState(false);

  async function loadList() {
    try {
      const [u, s] = await Promise.all([
        fetchAdminUsers(),
        fetchAdminSubscriptions(),
      ]);
      setUsers(u);
      setSubs(s);
      updateCache({ users: u, subscriptions: s });
    } catch (err) {
      if (isModuleForbiddenError(err)) setNoModuleAccess(true);
      else toast.error("Couldn't load customers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadList();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    setDetailTab("overview");
    void fetchAdminCustomerProfile(selectedId)
      .then((p) => setProfile(p))
      .catch((err) => {
        if (isModuleForbiddenError(err)) setNoModuleAccess(true);
        else toast.error("Couldn't load customer details.");
      })
      .finally(() => setProfileLoading(false));
  }, [selectedId]);

  const customers = useMemo(
    () => users.filter((u) => u.role === "user"),
    [users],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return customers.filter((u) => {
      if (filter !== "all") {
        const s = subs.find((x) => x.userId === u.id);
        if (s?.status !== filter) return false;
      }
      if (needle) {
        if (
          !u.name.toLowerCase().includes(needle) &&
          !u.email.toLowerCase().includes(needle)
        )
          return false;
      }
      return true;
    });
  }, [customers, subs, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  function setBusy(id: string, on: boolean) {
    setActionBusy((prev) => ({ ...prev, [id]: on }));
  }

  async function resetPassword(u: AdminUserRow) {
    setBusy(u.id, true);
    try {
      await adminTriggerCustomerPasswordReset(u.id);
      toast.success("Password reset email queued.", `Sent to ${u.email}.`);
    } catch (err) {
      toast.error(
        "Couldn't send reset email.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBusy(u.id, false);
    }
  }

  async function syncStripe(u: AdminUserRow) {
    setBusy(u.id, true);
    try {
      await syncAdminCustomerStripe(u.id);
      toast.success("Synced from Stripe.");
      await loadList();
      if (selectedId === u.id) {
        setProfile(await fetchAdminCustomerProfile(u.id));
      }
    } catch (err) {
      toast.error(
        "Stripe sync failed.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBusy(u.id, false);
    }
  }

  async function confirmDeactivate() {
    if (!deactivateOpen) return;
    setDeactivateBusy(true);
    try {
      if (deactivateOpen.isActive) {
        await deactivateAdminCustomer(
          deactivateOpen.userId,
          deactivateReason || undefined,
        );
        toast.success("Customer deactivated.");
      } else {
        await reactivateAdminCustomer(deactivateOpen.userId);
        toast.success("Customer reactivated.");
      }
      await loadList();
      if (selectedId === deactivateOpen.userId) {
        setProfile(await fetchAdminCustomerProfile(deactivateOpen.userId));
      }
      setDeactivateOpen(null);
      setDeactivateReason("");
    } catch (err) {
      toast.error(
        "Couldn't update customer.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setDeactivateBusy(false);
    }
  }

  async function startDelete(u: AdminUserRow) {
    try {
      const preview = await fetchAdminCustomerDeletePreview(u.id);
      setDeleteOpen({
        userId: u.id,
        email: preview.email,
        counts: preview.counts,
      });
      setDeleteConfirmInput("");
    } catch {
      toast.error("Couldn't load delete preview.");
    }
  }

  async function confirmDelete() {
    if (!deleteOpen) return;
    if (deleteConfirmInput !== deleteOpen.email) {
      toast.warning("Email doesn't match exactly.");
      return;
    }
    setDeleting(true);
    try {
      await deleteAdminCustomer(deleteOpen.userId, deleteOpen.email);
      toast.success("Customer deleted.");
      setSelectedId(null);
      setDeleteOpen(null);
      setDeleteConfirmInput("");
      await loadList();
    } catch {
      toast.error("Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  const activeCount = subs.filter((s) => s.status === "active").length;
  const totalMrr = subs.reduce(
    (sum, s) => sum + (s.plan?.priceMonthlyCents ?? 0),
    0,
  );

  if (noModuleAccess) {
    return <NoModuleAccess moduleLabel="Customers" />;
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b border-[var(--border-subtle)] pb-4">
        <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          People
        </p>
        <h1 className="mt-1.5 font-ui text-sx-xl font-semibold text-[var(--text-primary)]">
          Customers
        </h1>
        <p className="mt-1 text-sx-sm text-[var(--text-secondary)]">
          Search by name or email. Click a row to open the customer drawer.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
          <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            Active subs
          </p>
          <p className="mt-2 font-display text-sx-2xl font-semibold text-[var(--text-primary)]">
            {activeCount}
          </p>
        </div>
        <div className="rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
          <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            Estimated MRR
          </p>
          <p className="mt-2 font-display text-sx-2xl font-semibold text-[var(--text-primary)]">
            {money(totalMrr)}
          </p>
        </div>
        <div className="rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
          <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            Customers
          </p>
          <p className="mt-2 font-display text-sx-2xl font-semibold text-[var(--text-primary)]">
            {customers.length}
          </p>
        </div>
        <div className="rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
          <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            Past due
          </p>
          <p className="mt-2 font-display text-sx-2xl font-semibold text-[var(--text-primary)]">
            {subs.filter((s) => s.status === "past_due").length}
          </p>
        </div>
      </section>

      <SxPanel title="Filter">
        <div className="flex flex-wrap items-end gap-3">
          <SxInput
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or email…"
            containerClassName="min-w-[240px] flex-1"
          />
          <SxSegmentedControl<StatusFilter>
            ariaLabel="Status filter"
            size="sm"
            options={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "trialing", label: "Trial" },
              { value: "past_due", label: "Past due" },
              { value: "paused", label: "Paused" },
              { value: "canceled", label: "Canceled" },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </div>
      </SxPanel>

      <SxPanel padded={false}>
        {loading ? (
          <p className="p-5 text-sx-sm text-[var(--text-tertiary)]">Loading…</p>
        ) : paginated.length === 0 ? (
          <div className="p-5">
            <SxEmptyState
              title="No customers in this view."
              description="Adjust the filter or search to see more."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sx-sm">
              <thead>
                <tr className="bg-[var(--surface-sunken)] text-left">
                  <th className="px-4 py-3 font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-medium">
                    Customer
                  </th>
                  <th className="px-4 py-3 font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-medium">
                    Plan
                  </th>
                  <th className="px-4 py-3 font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-medium">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((u) => {
                  const sub = subs.find((s) => s.userId === u.id);
                  const busy = actionBusy[u.id];
                  return (
                    <tr
                      key={u.id}
                      className="border-t border-[var(--border-subtle)] hover:bg-[var(--surface-sunken)]"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedId(u.id)}
                          className="text-left"
                        >
                          <p className="font-medium text-[var(--text-primary)]">
                            {u.name}
                          </p>
                          <p className="font-mono text-sx-2xs text-[var(--text-tertiary)]">
                            {u.email}
                            {u.isActive === false ? " · deactivated" : ""}
                          </p>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {sub?.plan?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {sub ? subscriptionBadge(sub.status) : (
                          <SxBadge variant="neutral">No subscription</SxBadge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <SxButton
                            variant="secondary"
                            size="sm"
                            loading={busy}
                            onClick={() => void resetPassword(u)}
                          >
                            Reset password
                          </SxButton>
                          <SxButton
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedId(u.id)}
                          >
                            Open
                          </SxButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-4 py-3">
            <p className="font-mono text-sx-xs text-[var(--text-tertiary)]">
              Page {page} of {totalPages} · {filtered.length} customers
            </p>
            <div className="flex gap-2">
              <SxButton
                variant="secondary"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </SxButton>
              <SxButton
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </SxButton>
            </div>
          </div>
        ) : null}
      </SxPanel>

      {/* Detail drawer */}
      {selectedId ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={() => setSelectedId(null)}
        >
          <div
            role="dialog"
            aria-modal
            className="h-full w-full max-w-[640px] overflow-y-auto border-l border-[var(--border-default)] bg-[var(--surface-card)] p-6 shadow-sx-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {profileLoading || !profile ? (
              <p className="text-sx-sm text-[var(--text-tertiary)]">Loading customer…</p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
                  <div>
                    <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                      Customer
                    </p>
                    <h2 className="mt-1 font-ui text-sx-lg font-semibold text-[var(--text-primary)]">
                      {profile.overview.user.name}
                    </h2>
                    <p className="mt-1 font-mono text-sx-xs text-[var(--text-tertiary)]">
                      {profile.overview.user.email} · joined{" "}
                      {formatDate(profile.overview.user.createdAt)}
                    </p>
                    <p className="mt-2 font-display text-sx-2xl font-semibold text-[var(--text-brand)]">
                      {money(profile.overview.totalGeneratedRevenueCents)}
                    </p>
                    <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                      Total revenue
                    </p>
                  </div>
                  <SxButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedId(null)}
                  >
                    Close
                  </SxButton>
                </div>

                <div className="mt-4">
                  <SxSegmentedControl<DetailTab>
                    ariaLabel="Section"
                    size="sm"
                    options={[
                      { value: "overview", label: "Overview" },
                      {
                        value: "tickets",
                        label: "Tickets",
                        count: profile.tickets.length,
                      },
                      {
                        value: "documents",
                        label: "Documents",
                        count: profile.documents.length,
                      },
                      {
                        value: "transactions",
                        label: "Transactions",
                        count: profile.transactions.length,
                      },
                    ]}
                    value={detailTab}
                    onChange={setDetailTab}
                  />
                </div>

                <div className="mt-5 flex flex-col gap-3">
                  {detailTab === "overview" ? (
                    <>
                      <SxPanel title="Projects">
                        {profile.overview.projects.length === 0 ? (
                          <p className="text-sx-sm text-[var(--text-tertiary)]">
                            No projects yet.
                          </p>
                        ) : (
                          <ul className="divide-y divide-[var(--border-subtle)]">
                            {profile.overview.projects.map((row) => (
                              <li key={row.projectId} className="py-3 first:pt-0 last:pb-0">
                                <p className="font-medium text-[var(--text-primary)]">
                                  {row.projectName}
                                </p>
                                {row.subscription ? (
                                  <p className="mt-1 font-mono text-sx-xs text-[var(--text-tertiary)]">
                                    {row.subscription.plan?.name ?? "—"} ·{" "}
                                    {row.subscription.billingCycle} ·{" "}
                                    {row.subscription.status} · renews{" "}
                                    {formatDate(row.subscription.currentPeriodEnd)}
                                  </p>
                                ) : (
                                  <p className="mt-1 text-sx-xs text-[var(--text-tertiary)]">
                                    No subscription
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </SxPanel>

                      <SxPanel title="Actions">
                        <div className="flex flex-wrap gap-2">
                          {profile.overview.user.isActive ? (
                            <SxButton
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                setDeactivateOpen({
                                  userId: profile.overview.user.id,
                                  name: profile.overview.user.name,
                                  isActive: true,
                                })
                              }
                            >
                              Deactivate
                            </SxButton>
                          ) : (
                            <SxButton
                              variant="primary"
                              size="sm"
                              onClick={() =>
                                setDeactivateOpen({
                                  userId: profile.overview.user.id,
                                  name: profile.overview.user.name,
                                  isActive: false,
                                })
                              }
                            >
                              Reactivate
                            </SxButton>
                          )}
                          <SxButton
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              const u = users.find(
                                (x) => x.id === profile.overview.user.id,
                              );
                              if (u) void syncStripe(u);
                            }}
                          >
                            Sync from Stripe
                          </SxButton>
                          <Link
                            to={`/admin/users/${profile.overview.user.id}/documents`}
                          >
                            <SxButton variant="secondary" size="sm">
                              Manage documents
                            </SxButton>
                          </Link>
                          <SxButton
                            variant="ghost"
                            size="sm"
                            className="!text-[var(--color-danger-fg)]"
                            onClick={() => {
                              const u = users.find(
                                (x) => x.id === profile.overview.user.id,
                              );
                              if (u) void startDelete(u);
                            }}
                          >
                            Delete customer
                          </SxButton>
                        </div>
                      </SxPanel>
                    </>
                  ) : detailTab === "tickets" ? (
                    <SxPanel padded={false}>
                      {profile.tickets.length === 0 ? (
                        <p className="p-5 text-sx-sm text-[var(--text-tertiary)]">
                          No tickets yet.
                        </p>
                      ) : (
                        <ul className="divide-y divide-[var(--border-subtle)]">
                          {profile.tickets.map((t) => (
                            <li key={t.id} className="px-5 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-[var(--text-primary)]">
                                    {t.subject}
                                  </p>
                                  <p className="font-mono text-sx-2xs text-[var(--text-tertiary)]">
                                    {t.department} · {t.threadCount} msgs ·{" "}
                                    {formatDate(t.updatedAt)}
                                  </p>
                                </div>
                                <SxBadge variant={t.status === "resolved" ? "resolved" : t.status === "closed" ? "closed" : t.status === "in_progress" ? "progress" : "open"}>
                                  {t.status.replace("_", " ")}
                                </SxBadge>
                                <Link to={`/admin/tickets/${t.id}`}>
                                  <SxButton variant="secondary" size="sm">
                                    Open
                                  </SxButton>
                                </Link>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </SxPanel>
                  ) : detailTab === "documents" ? (
                    <SxPanel padded={false}>
                      {profile.documents.length === 0 ? (
                        <p className="p-5 text-sx-sm text-[var(--text-tertiary)]">
                          No documents yet.
                        </p>
                      ) : (
                        <ul className="divide-y divide-[var(--border-subtle)]">
                          {profile.documents.map((d) => (
                            <li key={d.id} className="px-5 py-3">
                              <p className="font-medium text-[var(--text-primary)]">
                                {d.title}
                              </p>
                              <p className="mt-0.5 font-mono text-sx-2xs text-[var(--text-tertiary)]">
                                {d.category} · {d.fileName} ·{" "}
                                {formatDate(d.createdAt)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="border-t border-[var(--border-subtle)] px-5 py-3">
                        <Link
                          to={`/admin/users/${profile.overview.user.id}/documents`}
                        >
                          <SxButton variant="secondary" size="sm">
                            Upload / manage all documents
                          </SxButton>
                        </Link>
                      </div>
                    </SxPanel>
                  ) : (
                    <SxPanel padded={false}>
                      {profile.transactions.length === 0 ? (
                        <p className="p-5 text-sx-sm text-[var(--text-tertiary)]">
                          No transactions yet.
                        </p>
                      ) : (
                        <ul className="divide-y divide-[var(--border-subtle)]">
                          {profile.transactions.map((tx) => (
                            <li key={tx.id} className="px-5 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-mono text-sx-sm text-[var(--text-primary)]">
                                    {tx.invoiceNumber}
                                  </p>
                                  <p className="font-mono text-sx-2xs text-[var(--text-tertiary)]">
                                    {formatDate(tx.createdAt)} · {tx.paymentMode}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-mono font-semibold text-[var(--text-primary)]">
                                    {money(tx.amountCents, tx.currency)}
                                  </p>
                                  <SxBadge
                                    variant={
                                      tx.status === "succeeded"
                                        ? "success"
                                        : tx.status === "failed"
                                          ? "danger"
                                          : "warning"
                                    }
                                  >
                                    {tx.status}
                                  </SxBadge>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </SxPanel>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Deactivate / reactivate */}
      <SxConfirmDialog
        open={deactivateOpen !== null}
        title={
          deactivateOpen?.isActive
            ? `Deactivate ${deactivateOpen.name}?`
            : `Reactivate ${deactivateOpen?.name}?`
        }
        body={
          deactivateOpen?.isActive ? (
            <div className="flex flex-col gap-3">
              <p>
                The customer can no longer sign in. Subscriptions stay intact. You can reactivate later.
              </p>
              <SxInput
                label="Reason (optional)"
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder="Chargeback, off-platform, etc."
              />
            </div>
          ) : (
            "The customer can sign in again immediately."
          )
        }
        confirmLabel={deactivateOpen?.isActive ? "Deactivate" : "Reactivate"}
        destructive={deactivateOpen?.isActive}
        loading={deactivateBusy}
        onConfirm={() => void confirmDeactivate()}
        onCancel={() => {
          if (deactivateBusy) return;
          setDeactivateOpen(null);
          setDeactivateReason("");
        }}
      />

      {/* Delete (hard) */}
      <SxConfirmDialog
        open={deleteOpen !== null}
        title="Delete customer permanently?"
        body={
          deleteOpen ? (
            <div className="flex flex-col gap-3">
              <p>
                This wipes the customer and all their data — including{" "}
                <strong>{deleteOpen.counts.subscriptions}</strong> subscriptions,{" "}
                <strong>{deleteOpen.counts.payments}</strong> payments,{" "}
                <strong>{deleteOpen.counts.tickets}</strong> tickets, and{" "}
                <strong>{deleteOpen.counts.documents}</strong> documents. This can't be undone.
              </p>
              <SxInput
                label={`Type "${deleteOpen.email}" to confirm`}
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder={deleteOpen.email}
              />
            </div>
          ) : null
        }
        confirmLabel="Delete forever"
        destructive
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (deleting) return;
          setDeleteOpen(null);
          setDeleteConfirmInput("");
        }}
      />
    </div>
  );
}
