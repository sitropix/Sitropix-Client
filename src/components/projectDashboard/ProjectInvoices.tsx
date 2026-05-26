import { useEffect, useState } from "react";
import { SxBadge } from "@/components/sx/Badge";
import { SxEmptyState } from "@/components/sx/EmptyState";
import { SxPanel } from "@/components/sx/Panel";
import { getProjectFinance } from "@/services/projectWorkflowApi";
import type { ProjectFinancePayload } from "@/types/projectWorkflow";

function money(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

export function ProjectInvoices(props: { projectId: string }) {
  const [data, setData] = useState<ProjectFinancePayload | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getProjectFinance(props.projectId)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData({ project: { id: props.projectId, name: "" }, subscription: null, plan: null, invoices: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [props.projectId]);

  const invoices = data?.invoices ?? [];

  return (
    <SxPanel title="Invoices & payments">
      {data === null ? (
        <p className="text-sx-sm text-[var(--text-tertiary)]">Loading…</p>
      ) : invoices.length === 0 ? (
        <SxEmptyState
          title="No invoices yet."
          description="Once your subscription is active, invoices will appear here."
        />
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)]">
          {invoices.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-sx-sm text-[var(--text-primary)]">
                  {inv.invoiceNumber}
                </p>
                <p className="font-mono text-sx-2xs text-[var(--text-tertiary)]">
                  {inv.paidAt ? `Paid ${new Date(inv.paidAt).toLocaleDateString()}` : "Not yet paid"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-sx-sm font-semibold text-[var(--text-primary)]">
                  {money(inv.amountCents, inv.currency)}
                </span>
                <SxBadge variant={inv.status === "succeeded" ? "success" : inv.status === "failed" ? "danger" : "warning"}>
                  {inv.status}
                </SxBadge>
                {inv.invoicePdfUrl ? (
                  <a
                    href={inv.invoicePdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sx-2xs font-semibold text-[var(--text-brand)] hover:underline"
                  >
                    PDF
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SxPanel>
  );
}
