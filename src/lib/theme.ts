export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "receipt_portal_theme";

export function getStoredTheme(): ThemePreference {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark") return value;
  } catch {
    // Storage can be unavailable (private mode, blocked); fall back to system.
  }
  return "system";
}

/** Applies a theme to <html>; "system" removes the override so the OS preference wins. */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", preference);
  }
  try {
    if (preference === "system") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Non-fatal: the theme just won't persist.
  }
}

export function resolvedTheme(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
