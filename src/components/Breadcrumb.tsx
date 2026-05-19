import { Link } from "react-router-dom";

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="font-body-sm text-body-sm text-on-surface-variant" aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, idx) => (
          <li key={`${item.label}-${idx}`} className="flex items-center gap-2">
            {idx > 0 && <span className="text-outline-variant">/</span>}
            {item.to ? (
              <Link to={item.to} className="transition hover:text-on-surface">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-on-surface">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
