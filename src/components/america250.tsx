import { AMERICA250_COLORS, isAmerica250Active } from "@/lib/america250";

/* ------------------------------------------------------------------ */
/* Banner — top of homepage, above the existing nav                   */
/* ------------------------------------------------------------------ */

export function America250Banner() {
  if (!isAmerica250Active()) return null;

  return (
    <div
      role="presentation"
      aria-label="America's 250th anniversary"
      className="sticky top-0 z-50 w-full"
      style={{
        background: AMERICA250_COLORS.darkBlue,
        color: AMERICA250_COLORS.white,
        height: "36px",
      }}
    >
      <div className="mx-auto flex h-full max-w-[var(--container-wide)] items-center justify-center gap-2 px-4 sm:px-6 sm:h-[40px]">
        <span
          style={{
            fontFamily: '"DM Serif Display", Georgia, serif',
            fontSize: "13px",
            letterSpacing: "0.02em",
          }}
          className="whitespace-nowrap sm:text-[14px]"
        >
          1776{" "}
          <span style={{ color: AMERICA250_COLORS.gold }}>—</span> 2026
        </span>
        <span
          aria-hidden
          style={{ color: AMERICA250_COLORS.gold }}
          className="font-bold"
        >
          ·
        </span>
        <span
          style={{
            fontFamily: '"Open Sans", system-ui, sans-serif',
            fontWeight: 700,
            fontSize: "10px",
            letterSpacing: "0.14em",
          }}
          className="uppercase sm:text-[11px]"
        >
          <span className="hidden sm:inline">Celebrating </span>
          America's 250th
        </span>
      </div>
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[3px]"
        style={{
          background: `linear-gradient(90deg, ${AMERICA250_COLORS.red} 0%, ${AMERICA250_COLORS.white} 50%, ${AMERICA250_COLORS.blue} 100%)`,
        }}
      />
      {/* Sticky banner reserves its height — push the page-height padding via parent. */}
      <span className="block h-[3px]" aria-hidden />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Kicker — small label above the hero H1                             */
/* ------------------------------------------------------------------ */

export function America250Kicker() {
  if (!isAmerica250Active()) return null;

  return (
    <div
      role="presentation"
      aria-label="America's 250th anniversary"
      className="mb-3 inline-flex items-center gap-2"
      style={{
        fontFamily: '"Open Sans", system-ui, sans-serif',
        fontWeight: 700,
        fontSize: "13px",
        letterSpacing: "0.16em",
        color: AMERICA250_COLORS.red,
      }}
    >
      <span aria-hidden style={{ color: AMERICA250_COLORS.gold }}>
        ★
      </span>
      <span className="uppercase whitespace-nowrap">
        America's 250th Anniversary
      </span>
      <span aria-hidden style={{ color: AMERICA250_COLORS.gold }}>
        ★
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pill — decorative chip near the dashboard page header              */
/* ------------------------------------------------------------------ */

export function America250Pill() {
  if (!isAmerica250Active()) return null;

  return (
    <span
      role="presentation"
      aria-label="America's 250th anniversary"
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1"
      style={{
        background: AMERICA250_COLORS.darkBlue,
        color: AMERICA250_COLORS.white,
        fontFamily: '"Open Sans", system-ui, sans-serif',
        fontWeight: 700,
        fontSize: "11px",
        letterSpacing: "0.08em",
      }}
    >
      <span>America 250</span>
      <span aria-hidden style={{ color: AMERICA250_COLORS.gold }}>
        ·
      </span>
      <span style={{ fontWeight: 400 }}>1776–2026</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Footer line — above the existing copyright                         */
/* ------------------------------------------------------------------ */

export function America250FooterLine() {
  if (!isAmerica250Active()) return null;

  return (
    <p
      role="presentation"
      aria-label="America's 250th anniversary"
      style={{
        fontFamily: '"Open Sans", system-ui, sans-serif',
        fontWeight: 400,
        color: AMERICA250_COLORS.darkBlue,
        fontSize: "12px",
      }}
      className="text-center"
    >
      Proudly marking America's 250th anniversary{" "}
      <span style={{ color: AMERICA250_COLORS.red }}>—</span> July 4, 2026.
    </p>
  );
}
