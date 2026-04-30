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

export function InvoiceTable({ invoices, scrollable = false }: { invoices: Invoice[]; scrollable?: boolean }) {
  const mobileScroll = scrollable ? "max-h-[min(60vh,560px)] overflow-y-auto overscroll-contain" : "";
  const desktopScroll = scrollable
    ? "max-h-[min(60vh,560px)] overflow-auto overscroll-contain"
    : "overflow-x-auto";

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm">
      <div className={`space-y-2.5 p-3 sm:hidden ${mobileScroll}`}>
        {invoices.map((invoice) => (
          <div key={invoice.id} className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Invoice</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">{invoice.invoiceNumber}</p>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <p className="text-zinc-500">Date</p>
              <p className="text-right text-zinc-700">{prettyDate(invoice.paidAt ?? null)}</p>
              <p className="text-zinc-500">Amount</p>
              <p className="text-right font-medium text-zinc-900">{money(invoice.amountCents, invoice.currency)}</p>
              <p className="text-zinc-500">Status</p>
              <p className="text-right capitalize text-zinc-700">{invoice.status.replace("_", " ")}</p>
            </div>
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
              className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Download
            </button>
          </div>
        ))}
      </div>

      <div className={`hidden sm:block ${desktopScroll}`}>
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead
            className={`border-b border-zinc-300 bg-zinc-100 ${scrollable ? "sticky top-0 z-[1] shadow-[inset_0_-1px_0_0_rgba(203,203,203,1)]" : ""}`}
          >
            <tr className="text-[9px] font-semibold uppercase tracking-[0.11em] text-zinc-600">
              <th className="px-3 py-2.5 font-medium sm:px-4">Invoice</th>
              <th className="px-3 py-2.5 font-medium sm:px-4">Date</th>
              <th className="px-3 py-2.5 font-medium sm:px-4">Amount</th>
              <th className="px-3 py-2.5 font-medium sm:px-4">Status</th>
              <th className="px-3 py-2.5 font-medium sm:px-4">Action</th>
            </tr>
          </thead>
          <tbody className="text-zinc-900">
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-t border-zinc-200 transition hover:bg-zinc-50">
                <td className="px-3 py-3 font-medium sm:px-4">{invoice.invoiceNumber}</td>
                <td className="px-3 py-3 text-zinc-600 sm:px-4">{prettyDate(invoice.paidAt ?? null)}</td>
                <td className="px-3 py-3 tabular-nums sm:px-4">{money(invoice.amountCents, invoice.currency)}</td>
                <td className="px-3 py-3 capitalize sm:px-4">{invoice.status.replace("_", " ")}</td>
                <td className="px-3 py-2.5 sm:px-4">
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
                    className="rounded-lg border border-zinc-300 bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
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
