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
    expect(resolveTheme("light", true)).toBe("glass");
    expect(resolveTheme("light", false)).toBe("glass");
  });

  test("stored dark always wins", () => {
    expect(resolveTheme("dark", true)).toBe("glass-dark");
    expect(resolveTheme("dark", false)).toBe("glass-dark");
  });

  test("null and garbage follow the OS", () => {
    expect(resolveTheme(null, true)).toBe("glass-dark");
    expect(resolveTheme(null, false)).toBe("glass");
    expect(resolveTheme("system", true)).toBe("glass-dark");
    expect(resolveTheme("", false)).toBe("glass");
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
    applyTheme("glass-dark", root);
    expect(root.dataset.theme).toBe("glass-dark");
    expect(root.style.colorScheme).toBe("dark");
    expect(attrs["data-theme"]).toBe("glass-dark");
    expect(attrs["color-scheme"]).toBe("dark");
    applyTheme("glass", root);
    expect(root.dataset.theme).toBe("glass");
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
