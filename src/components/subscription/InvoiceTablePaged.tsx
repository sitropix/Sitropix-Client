import { useEffect, useMemo, useState } from "react";
import type { Invoice } from "@/types/subscription";
import { InvoiceTable } from "./InvoiceTable";

const DEFAULT_PAGE_SIZE = 4;

export function InvoiceTablePaged({
  invoices,
  pageSize = DEFAULT_PAGE_SIZE,
  scrollable = false,
}: {
  invoices: Invoice[];
  pageSize?: number;
  scrollable?: boolean;
}) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(invoices.length / pageSize));
  const pagedInvoices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return invoices.slice(start, start + pageSize);
  }, [page, invoices, pageSize]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  return (
    <>
      <InvoiceTable invoices={pagedInvoices} scrollable={scrollable} />
      {pageCount > 1 ? (
        <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2" role="navigation" aria-label="Invoice pages">
          {Array.from({ length: pageCount }, (_, idx) => idx + 1).map((n) => {
            const isActive = n === page;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-2 text-[11px] font-semibold transition ${
                  isActive
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500 hover:text-zinc-900"
                }`}
                aria-label={`Go to invoices page ${n}`}
                aria-current={isActive ? "page" : undefined}
              >
                {n}
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
