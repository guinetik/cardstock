"use client";

import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  applyTheme,
  resolveTheme,
  shouldFollowSystem,
  THEME_STORAGE_KEY,
  type ThemeName,
  type ThemeRoot,
} from "@/lib/theme";

/**
 * Light/dark state and toggle for components that switch the paper theme.
 * Follows `prefers-color-scheme` only until the user stores an explicit choice.
 */
export function useThemeToggle() {
  const [theme, setTheme] = useState<ThemeName>("paper");
  const mqRef = useRef<MediaQueryList | null>(null);
  const onChangeRef = useRef<(() => void) | null>(null);

  /**
   * Drop the `matchMedia` subscription once a stored theme exists (or on unmount).
   */
  const detachSystemListener = useCallback(() => {
    const mq = mqRef.current;
    const onChange = onChangeRef.current;
    if (mq && onChange) {
      mq.removeEventListener("change", onChange);
    }
    mqRef.current = null;
    onChangeRef.current = null;
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const current =
      root.dataset.theme === "paper-night" ? "paper-night" : "paper";
    setTheme(current);

    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (!shouldFollowSystem(stored)) return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let storedNow: string | null = null;
      try {
        storedNow = localStorage.getItem(THEME_STORAGE_KEY);
      } catch {
        storedNow = null;
      }
      if (!shouldFollowSystem(storedNow)) return;
      const next = resolveTheme(null, mq.matches);
      applyTheme(next, root as ThemeRoot);
      setTheme(next);
    };
    mqRef.current = mq;
    onChangeRef.current = onChange;
    mq.addEventListener("change", onChange);
    return () => detachSystemListener();
  }, [detachSystemListener]);

  const dark = theme === "paper-night";

  /** Persist light/dark and stop listening to the OS scheme. */
  const toggle = useCallback(() => {
    const next: ThemeName = dark ? "paper" : "paper-night";
    const stored = next === "paper-night" ? "dark" : "light";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, stored);
    } catch {
      /* private mode */
    }
    applyTheme(next, document.documentElement as ThemeRoot);
    setTheme(next);
    detachSystemListener();
  }, [dark, detachSystemListener]);

  return { dark, toggle };
}

/**
 * Two-state light/dark control. Writes `localStorage.theme` as `"light"` | `"dark"`.
 *
 * @param className - Optional layout overrides when the toggle sits in a menu row.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { dark, toggle } = useThemeToggle();

  return (
    <button
      type="button"
      className={
        className ??
        "inline-flex size-8 items-center justify-center text-[var(--color-ink)] hover:bg-[var(--fill-subtle)]"
      }
      aria-label="Toggle colour theme"
      aria-pressed={dark}
      suppressHydrationWarning
      onClick={toggle}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

/** Account-menu row: the whole item toggles light/dark, not just the icon. */
export function ThemeMenuItem() {
  const { dark, toggle } = useThemeToggle();

  return (
    <DropdownMenuItem
      onClick={toggle}
      aria-label="Toggle colour theme"
      aria-pressed={dark}
      className="justify-between"
    >
      Theme
      <span
        className="inline-flex size-8 items-center justify-center text-[var(--color-ink)]"
        aria-hidden="true"
        suppressHydrationWarning
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </span>
    </DropdownMenuItem>
  );
}
