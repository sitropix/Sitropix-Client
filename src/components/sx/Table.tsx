import type { ReactNode } from "react";

export interface SxTableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  width?: string;
  align?: "left" | "right" | "center";
  mono?: boolean;
}

export interface SxTableProps<T> {
  columns: ReadonlyArray<SxTableColumn<T>>;
  rows: ReadonlyArray<T>;
  rowKey: (row: T, index: number) => string;
  empty?: ReactNode;
  className?: string;
  onRowClick?: (row: T) => void;
  ariaLabel?: string;
}

export function SxTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  className = "",
  onRowClick,
  ariaLabel,
}: SxTableProps<T>) {
  return (
    <div
      className={[
        "overflow-hidden rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)]",
        className,
      ].join(" ")}
    >
      <table className="w-full border-collapse text-sx-sm" aria-label={ariaLabel}>
        <thead>
          <tr className="bg-[var(--surface-sunken)]">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={col.width ? { width: col.width } : undefined}
                className={[
                  "border-b border-[var(--border-subtle)] px-4 py-3",
                  "font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-medium",
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                      ? "text-center"
                      : "text-left",
                ].join(" ")}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sx-sm text-[var(--text-tertiary)]"
              >
                {empty ?? "No rows."}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={[
                  "border-b border-[var(--border-subtle)] last:border-b-0",
                  onRowClick
                    ? "cursor-pointer transition-colors duration-[150ms] hover:bg-[var(--surface-sunken)]"
                    : "",
                ].join(" ")}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={[
                      "px-4 py-3 align-middle text-[var(--text-primary)]",
                      col.mono ? "font-mono text-sx-xs" : "",
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                          ? "text-center"
                          : "text-left",
                    ].join(" ")}
                  >
                    {col.cell(row, index)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
