export const THEME_STORAGE_KEY = "theme";

export type ThemeName = "glass" | "glass-dark";

export type ThemeRoot = {
  dataset: { theme?: string };
  style: { colorScheme: string };
  setAttribute: (name: string, value: string) => void;
};

/**
 * Map a stored preference and the OS colour scheme to a data-theme value.
 * Only `"light"` and `"dark"` in storage count; anything else follows the OS.
 */
export function resolveTheme(
  stored: string | null,
  prefersDark: boolean,
): ThemeName {
  if (stored === "light") return "glass";
  if (stored === "dark") return "glass-dark";
  return prefersDark ? "glass-dark" : "glass";
}

/**
 * True when the OS colour scheme should still drive the theme.
 */
export function shouldFollowSystem(stored: string | null): boolean {
  return stored !== "light" && stored !== "dark";
}

/**
 * Write `data-theme` and `color-scheme` onto the document root (or a test double).
 */
export function applyTheme(theme: ThemeName, root: ThemeRoot): void {
  const scheme = theme === "glass-dark" ? "dark" : "light";
  root.dataset.theme = theme;
  root.style.colorScheme = scheme;
  root.setAttribute("data-theme", theme);
  root.setAttribute("color-scheme", scheme);
}

/**
 * Blocking inline script for the root layout. Keep in sync with `resolveTheme`.
 * Runs in the browser with no module loader; layout injects this string as-is.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){
  try {
    var stored = null;
    try { stored = localStorage.getItem("theme"); } catch (e) {}
    var prefersDark = false;
    try { prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) {}
    var theme = stored === "light" ? "glass" : stored === "dark" ? "glass-dark" : prefersDark ? "glass-dark" : "glass";
    var root = document.documentElement;
    var scheme = theme === "glass-dark" ? "dark" : "light";
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = scheme;
    root.setAttribute("color-scheme", scheme);
  } catch (e) {}
})();`;
