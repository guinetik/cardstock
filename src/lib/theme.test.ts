import { describe, expect, test } from "bun:test";
import {
  applyTheme,
  resolveTheme,
  shouldFollowSystem,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
  type ThemeRoot,
} from "./theme";

describe("resolveTheme", () => {
  test("stored light always wins", () => {
    expect(resolveTheme("light", true)).toBe("paper");
    expect(resolveTheme("light", false)).toBe("paper");
  });

  test("stored dark always wins", () => {
    expect(resolveTheme("dark", true)).toBe("paper-night");
    expect(resolveTheme("dark", false)).toBe("paper-night");
  });

  test("null and garbage follow the OS", () => {
    expect(resolveTheme(null, true)).toBe("paper-night");
    expect(resolveTheme(null, false)).toBe("paper");
    expect(resolveTheme("system", true)).toBe("paper-night");
    expect(resolveTheme("", false)).toBe("paper");
  });
});

describe("shouldFollowSystem", () => {
  test("only an explicit light/dark choice stops following", () => {
    expect(shouldFollowSystem("light")).toBe(false);
    expect(shouldFollowSystem("dark")).toBe(false);
    expect(shouldFollowSystem(null)).toBe(true);
    expect(shouldFollowSystem("nope")).toBe(true);
  });
});

describe("applyTheme", () => {
  test("sets data-theme and color-scheme on the root", () => {
    const attrs: Record<string, string> = {};
    const root: ThemeRoot = {
      dataset: {},
      style: { colorScheme: "" },
      setAttribute(name, value) {
        attrs[name] = value;
      },
    };
    applyTheme("paper-night", root);
    expect(root.dataset.theme).toBe("paper-night");
    expect(root.style.colorScheme).toBe("dark");
    expect(attrs["data-theme"]).toBe("paper-night");
    expect(attrs["color-scheme"]).toBe("dark");
    applyTheme("paper", root);
    expect(root.dataset.theme).toBe("paper");
    expect(root.style.colorScheme).toBe("light");
  });
});

describe("THEME_BOOTSTRAP_SCRIPT", () => {
  test("inlines the same storage key and resolve rules", () => {
    expect(THEME_STORAGE_KEY).toBe("theme");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('localStorage.getItem("theme")');
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('stored === "light"');
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('stored === "dark"');
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("prefers-color-scheme: dark");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("data-theme");
  });
});
