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
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/[0.03] text-ink-subtle">
          <tr>
            <th className="px-4 py-3 font-medium">Invoice</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="border-t border-white/10 text-white/90">
              <td className="px-4 py-3">{invoice.invoiceNumber}</td>
              <td className="px-4 py-3 text-ink-muted">{prettyDate(invoice.paidAt ?? null)}</td>
              <td className="px-4 py-3">{money(invoice.amountCents, invoice.currency)}</td>
              <td className="px-4 py-3 capitalize">{invoice.status.replace("_", " ")}</td>
              <td className="px-4 py-3">
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
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-brand-lime/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Download
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
