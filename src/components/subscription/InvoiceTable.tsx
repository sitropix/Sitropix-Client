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
    <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-zinc-300 bg-zinc-100">
            <tr className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
              <th className="px-4 py-3 font-medium sm:px-5">Invoice</th>
              <th className="px-4 py-3 font-medium sm:px-5">Date</th>
              <th className="px-4 py-3 font-medium sm:px-5">Amount</th>
              <th className="px-4 py-3 font-medium sm:px-5">Status</th>
              <th className="px-4 py-3 font-medium sm:px-5">Action</th>
            </tr>
          </thead>
          <tbody className="text-zinc-900">
            {invoices.map((invoice) => (
              <tr
                key={invoice.id}
                className="border-t border-zinc-200 transition hover:bg-zinc-50"
              >
                <td className="px-4 py-3.5 font-medium sm:px-5">{invoice.invoiceNumber}</td>
                <td className="px-4 py-3.5 text-zinc-600 sm:px-5">{prettyDate(invoice.paidAt ?? null)}</td>
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
                    className="rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
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
