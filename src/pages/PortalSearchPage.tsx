import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/Skeleton";
import { SxButton } from "@/components/sx/Button";
import { SxEmptyState } from "@/components/sx/EmptyState";
import { SxPageHeader } from "@/components/sx/PageHeader";
import { useSubscriptionPortal } from "@/context/SubscriptionPortalContext";
import { useTickets } from "@/hooks/useTickets";
import { fetchKBArticles } from "@/services/supportApi";
import { fetchMyDocuments } from "@/services/subscriptionsApi";
import type { KBArticle, SupportTicket } from "@/types/support";
import type { ClientDocumentRow, Invoice, Plan } from "@/types/subscription";

function includesNeedle(haystack: string | undefined | null, needle: string) {
  if (!needle) return true;
  return (haystack ?? "").toLowerCase().includes(needle);
}

function money(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

function filterTickets(tickets: SupportTicket[], needle: string) {
  if (!needle) return [];
  return tickets.filter(
    (t) =>
      includesNeedle(t.subject, needle) ||
      includesNeedle(t.description, needle) ||
      includesNeedle(t.department, needle) ||
      includesNeedle(t.id, needle),
  );
}

function filterArticles(articles: KBArticle[], needle: string) {
  if (!needle) return [];
  return articles.filter(
    (a) => includesNeedle(a.title, needle) || includesNeedle(a.excerpt, needle) || includesNeedle(a.id, needle),
  );
}

function filterDocuments(rows: ClientDocumentRow[], needle: string) {
  if (!needle) return [];
  return rows.filter(
    (d) =>
      includesNeedle(d.title, needle) ||
      includesNeedle(d.category, needle) ||
      includesNeedle(d.fileName, needle) ||
      includesNeedle(d.id, needle),
  );
}

function filterInvoices(invoices: Invoice[], needle: string) {
  if (!needle) return [];
  return invoices.filter(
    (inv) =>
      includesNeedle(inv.invoiceNumber, needle) ||
      includesNeedle(inv.status, needle) ||
      includesNeedle(inv.failureReason, needle) ||
      includesNeedle(inv.id, needle),
  );
}

function filterPlans(plans: Plan[], needle: string) {
  if (!needle) return [];
  return plans.filter(
    (p) =>
      includesNeedle(p.name, needle) ||
      includesNeedle(p.description, needle) ||
      includesNeedle(p.code, needle) ||
      (p.features ?? []).some((f) => includesNeedle(f, needle)),
  );
}

export function PortalSearchPage() {
  const [params] = useSearchParams();
  const rawQ = params.get("q") ?? "";
  const needle = rawQ.trim().toLowerCase();

  const { tickets, loading: ticketsLoading } = useTickets();
  const { data: portal, loading: portalLoading } = useSubscriptionPortal();

  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [docs, setDocs] = useState<ClientDocumentRow[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  useEffect(() => {
    if (!needle) {
      setArticles([]);
      setDocs([]);
      setRemoteError(null);
      setRemoteLoading(false);
      return;
    }
    let cancelled = false;
    setRemoteLoading(true);
    setRemoteError(null);
    void Promise.all([fetchKBArticles(), fetchMyDocuments()])
      .then(([arts, docRows]) => {
        if (cancelled) return;
        setArticles(Array.isArray(arts) ? arts : []);
        setDocs(Array.isArray(docRows) ? docRows : []);
      })
      .catch(() => {
        if (!cancelled) {
          setRemoteError("Some results could not be loaded. Try again.");
          setArticles([]);
          setDocs([]);
        }
      })
      .finally(() => {
        if (!cancelled) setRemoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needle]);

  const kbHits = useMemo(() => filterArticles(articles, needle), [articles, needle]);
  const docHits = useMemo(() => filterDocuments(docs, needle), [docs, needle]);
  const ticketHits = useMemo(() => filterTickets(tickets, needle), [tickets, needle]);
  const invoiceHits = useMemo(() => filterInvoices(portal?.invoices ?? [], needle), [portal?.invoices, needle]);
  const planHits = useMemo(() => filterPlans(portal?.plans ?? [], needle), [portal?.plans, needle]);

  const subscriptionHit = useMemo(() => {
    if (!needle || !portal?.subscription?.plan) return false;
    const p = portal.subscription.plan;
    return (
      includesNeedle(p.name, needle) ||
      includesNeedle(p.description, needle) ||
      includesNeedle(p.code, needle) ||
      (p.features ?? []).some((f) => includesNeedle(f, needle))
    );
  }, [portal?.subscription?.plan, needle]);

  const totalHits =
    kbHits.length +
    docHits.length +
    ticketHits.length +
    invoiceHits.length +
    planHits.length +
    (subscriptionHit ? 1 : 0);

  const stillLoading = remoteLoading || ticketsLoading || portalLoading;
  const showEmpty = Boolean(needle && !stillLoading && totalHits === 0);
  const showResults = Boolean(needle && (stillLoading || totalHits > 0));

  useEffect(() => {
    document.title = needle ? `Search · ${rawQ} · Sitropix` : "Search · Sitropix";
  }, [needle, rawQ]);

  return (
    <div data-sx-root className="flex flex-col gap-6">
      <SxPageHeader
        title={needle ? `Results for "${rawQ}"` : "Search"}
        description="Across help articles, tickets, files, invoices, and plans."
      />

      {!needle ? (
        <SxEmptyState
          title="Enter a search term"
          description="Use the search field at the top to find tickets, files, invoices, plans, and help articles in one place."
          action={
            <Link to="/help">
              <SxButton variant="secondary">Open the help center</SxButton>
            </Link>
          }
        />
      ) : null}

      {needle && remoteError ? (
        <div className="rounded-sx-md border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-bg)] px-4 py-3 text-sx-sm text-[var(--color-warning-fg)]">
          {remoteError}
        </div>
      ) : null}

      {showEmpty ? (
        <SxEmptyState
          title={`Nothing matched "${rawQ}".`}
          description="Try a shorter search, or open a ticket and we'll help you find it."
          action={
            <Link to="/tickets/new">
              <SxButton variant="primary">Open a ticket</SxButton>
            </Link>
          }
        />
      ) : null}

      {showResults ? (
        <div className="space-y-10">
          {stillLoading && totalHits === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-glass">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-5/6" />
            </div>
          ) : null}
          {!portalLoading && subscriptionHit && portal?.subscription?.plan ? (
            <section className="space-y-3">
              <h2 className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Your subscription</h2>
              <Link
                to="/subscription-management"
                className="block rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                <p className="text-sm font-semibold text-zinc-900">{portal.subscription.plan.name}</p>
                <p className="mt-1 text-xs text-zinc-500">Open subscription management for billing and invoices.</p>
              </Link>
            </section>
          ) : null}

          {!remoteLoading && kbHits.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                Knowledge base ({kbHits.length})
              </h2>
              <ul className="space-y-2">
                {kbHits.map((a) => (
                  <li key={a.id}>
                    <Link
                      to={`/kb/article/${a.id}`}
                      className="block rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)]"
                    >
                      <p className="text-sm font-semibold text-zinc-900">{a.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{a.excerpt}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {!ticketsLoading && ticketHits.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                Support tickets ({ticketHits.length})
              </h2>
              <ul className="space-y-2">
                {ticketHits.map((t) => (
                  <li key={t.id}>
                    <Link
                      to={`/support/tickets/${t.id}`}
                      className="block rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)]"
                    >
                      <p className="text-xs font-mono text-zinc-500">#{t.id}</p>
                      <p className="mt-1 text-sm font-semibold text-zinc-900">{t.subject}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {!remoteLoading && docHits.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                Workspace documents ({docHits.length})
              </h2>
              <ul className="space-y-2">
                {docHits.map((d) => (
                  <li key={d.id}>
                    <Link
                      to={`/workspace?tab=documents`}
                      className="block rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)]"
                    >
                      <p className="text-sm font-semibold text-zinc-900">{d.title}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {d.category} · {d.fileName}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {!portalLoading && invoiceHits.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                Invoices ({invoiceHits.length})
              </h2>
              <ul className="space-y-2">
                {invoiceHits.map((inv) => (
                  <li key={inv.id}>
                    <Link
                      to="/subscription-management"
                      className="block rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)]"
                    >
                      <p className="text-sm font-semibold text-zinc-900">{inv.invoiceNumber}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {money(inv.amountCents, inv.currency)} · {inv.status}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {!portalLoading && planHits.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Plans ({planHits.length})</h2>
              <ul className="space-y-2">
                {planHits.map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/subscription"
                      className="block rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)]"
                    >
                      <p className="text-sm font-semibold text-zinc-900">{p.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{p.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
