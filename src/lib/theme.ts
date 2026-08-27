export const THEME_STORAGE_KEY = "theme";

export type ThemeName = "paper" | "paper-night";

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
  if (stored === "light") return "paper";
  if (stored === "dark") return "paper-night";
  return prefersDark ? "paper-night" : "paper";
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
  const scheme = theme === "paper-night" ? "dark" : "light";
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
    var theme = stored === "light" ? "paper" : stored === "dark" ? "paper-night" : prefersDark ? "paper-night" : "paper";
    var root = document.documentElement;
    var scheme = theme === "paper-night" ? "dark" : "light";
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = scheme;
    root.setAttribute("color-scheme", scheme);
  } catch (e) {}
})();`;
