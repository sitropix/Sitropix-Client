import type { Invoice } from "@/types/subscription";

function money(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

function prettyDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
}

export function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.09] bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.04]">
            <tr className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              <th className="px-4 py-3 font-medium sm:px-5">Invoice</th>
              <th className="px-4 py-3 font-medium sm:px-5">Date</th>
              <th className="px-4 py-3 font-medium sm:px-5">Amount</th>
              <th className="px-4 py-3 font-medium sm:px-5">Status</th>
              <th className="px-4 py-3 font-medium sm:px-5">Action</th>
            </tr>
          </thead>
          <tbody className="text-white/90">
            {invoices.map((invoice) => (
              <tr
                key={invoice.id}
                className="border-t border-white/[0.06] transition hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3.5 font-medium sm:px-5">{invoice.invoiceNumber}</td>
                <td className="px-4 py-3.5 text-ink-muted sm:px-5">{prettyDate(invoice.paidAt ?? null)}</td>
                <td className="px-4 py-3.5 tabular-nums sm:px-5">{money(invoice.amountCents, invoice.currency)}</td>
                <td className="px-4 py-3.5 capitalize sm:px-5">{invoice.status.replace("_", " ")}</td>
                <td className="px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    disabled={!invoice.invoicePdfUrl}
                    title={
                      invoice.invoicePdfUrl
                        ? "Open invoice (PDF or hosted page) in a new tab"
                        : "Invoice link not available yet — try Refresh or open the Stripe billing portal"
                    }
                    onClick={() => {
                      if (invoice.invoicePdfUrl) {
                        window.open(invoice.invoicePdfUrl, "_blank", "noopener,noreferrer");
                      }
                    }}
                    className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-brand-lime/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
