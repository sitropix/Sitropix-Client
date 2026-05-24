/**
 * UI v2 (brand-rebrand) feature flag.
 *
 * Default: enabled. The rebrand is the new canonical look.
 * Override via:
 *   localStorage.setItem("sitropix_ui_v2", "off")   // force legacy
 *   localStorage.setItem("sitropix_ui_v2", "on")    // force new
 * Or via URL: ?ui_v2=off
 */
const STORAGE_KEY = "sitropix_ui_v2";

export function isUiV2Enabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const url = new URL(window.location.href);
    const param = url.searchParams.get("ui_v2");
    if (param === "off") return false;
    if (param === "on") return true;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "off") return false;
    return true;
  } catch {
    return true;
  }
}

export function setUiV2(value: "on" | "off"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}
