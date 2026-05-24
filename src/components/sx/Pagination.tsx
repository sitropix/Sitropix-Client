import { SxButton } from "./Button";

export interface SxPaginationProps {
  page: number; // 1-indexed
  pageCount: number;
  onChange: (page: number) => void;
  className?: string;
}

export function SxPagination({ page, pageCount, onChange, className = "" }: SxPaginationProps) {
  if (pageCount <= 1) return null;
  const canPrev = page > 1;
  const canNext = page < pageCount;
  return (
    <nav
      aria-label="Pagination"
      className={["flex items-center justify-between gap-3", className].join(" ")}
    >
      <span className="font-mono text-sx-xs text-[var(--text-tertiary)]">
        Page {page} of {pageCount}
      </span>
      <div className="flex items-center gap-2">
        <SxButton
          variant="secondary"
          size="sm"
          onClick={() => canPrev && onChange(page - 1)}
          disabled={!canPrev}
        >
          Previous
        </SxButton>
        <SxButton
          variant="secondary"
          size="sm"
          onClick={() => canNext && onChange(page + 1)}
          disabled={!canNext}
        >
          Next
        </SxButton>
      </div>
    </nav>
  );
}
