export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "sitropix-portal-theme";

export function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return null;
}

export function resolveTheme(): Theme {
  const saved = readStoredTheme();
  if (saved) return saved;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

/** Apply theme to <html> before React paints (avoids flash of legacy canvas styles). */
export function applyThemeToDocument(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
}

applyThemeToDocument(resolveTheme());
