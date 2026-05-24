import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export interface SxLogoProps {
  to?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "default" | "inverse" | "brand" | "mark";
  className?: string;
  onClick?: () => void;
  children?: ReactNode;
}

const sizes = {
  sm: { glyph: 18, font: "text-sx-base" },
  md: { glyph: 22, font: "text-sx-lg" },
  lg: { glyph: 28, font: "text-sx-xl" },
  xl: { glyph: 40, font: "text-[2rem]" },
};

export function SxLogo({
  to,
  size = "md",
  variant = "default",
  className = "",
  onClick,
  children,
}: SxLogoProps) {
  const dims = sizes[size];
  const glyphBg =
    variant === "inverse"
      ? "bg-[var(--color-brand-300)]"
      : variant === "brand"
        ? "bg-[var(--color-ink-0)]"
        : "bg-[var(--color-brand-500)]";
  const innerAccent =
    variant === "brand" ? "bg-[var(--color-accent-500)]" : "bg-[var(--color-accent-500)]";
  const innerLine =
    variant === "inverse"
      ? "bg-[var(--color-ink-900)]"
      : variant === "brand"
        ? "bg-[var(--color-brand-500)]"
        : "bg-[var(--color-ink-0)]";

  const wordColor =
    variant === "inverse" || variant === "brand"
      ? "text-white"
      : "text-[var(--text-primary)]";

  const inner = (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`relative inline-block rounded-sx-sm ${glyphBg}`}
        style={{ width: dims.glyph, height: dims.glyph }}
        aria-hidden
      >
        <span
          className={`absolute rounded-sx-xs ${innerAccent}`}
          style={{
            top: dims.glyph * 0.18,
            right: dims.glyph * 0.18,
            width: dims.glyph * 0.25,
            height: dims.glyph * 0.25,
          }}
        />
        <span
          className={`absolute rounded-full ${innerLine}`}
          style={{
            bottom: dims.glyph * 0.16,
            left: dims.glyph * 0.16,
            width: dims.glyph * 0.42,
            height: Math.max(2, dims.glyph * 0.085),
          }}
        />
      </span>
      {variant !== "mark" ? (
        <span
          className={`font-display font-semibold leading-none [letter-spacing:var(--tracking-tight)] ${dims.font} ${wordColor}`}
        >
          {children ?? "Sitropix"}
        </span>
      ) : null}
    </span>
  );

  if (to) {
    return (
      <Link to={to} onClick={onClick} className="inline-flex items-center outline-none">
        {inner}
      </Link>
    );
  }
  return inner;
}
