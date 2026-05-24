/**
 * America 250 seasonal treatment gate.
 *
 * Wraps every public America 250 element. When `isAmerica250Active()` returns
 * false, every component (`America250Banner`, `America250Kicker`,
 * `America250Pill`, `America250FooterLine`) renders nothing. Removal after the
 * window is automatic — no code changes needed.
 *
 * Window ends late July 2026 (Eastern time). Computed against the user's clock,
 * which is fine for a decorative treatment.
 */
const END = new Date("2026-07-30T00:00:00-04:00");

export function isAmerica250Active(): boolean {
  return new Date() < END;
}

/** Shared palette so every America 250 component pulls from one place. */
export const AMERICA250_COLORS = {
  red: "#F90000",
  blue: "#3250FF",
  darkBlue: "#002858",
  gold: "#BFA148",
  slate: "#A7BACB",
  white: "#FFFFFF",
} as const;
