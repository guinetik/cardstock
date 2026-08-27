"use client";

import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyTheme,
  resolveTheme,
  shouldFollowSystem,
  THEME_STORAGE_KEY,
  type ThemeName,
  type ThemeRoot,
} from "@/lib/theme";

/**
 * Two-state light/dark control. Writes `localStorage.theme` as `"light"` | `"dark"`.
 * Follows `prefers-color-scheme` only until the user stores an explicit choice.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeName>("glass");
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
      root.dataset.theme === "glass-dark" ? "glass-dark" : "glass";
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

  const dark = theme === "glass-dark";

  /**
   * Persist light/dark and stop listening to the OS scheme.
   */
  function toggle() {
    const next: ThemeName = dark ? "glass" : "glass-dark";
    const stored = next === "glass-dark" ? "dark" : "light";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, stored);
    } catch {
      /* private mode */
    }
    applyTheme(next, document.documentElement as ThemeRoot);
    setTheme(next);
    detachSystemListener();
  }

  return (
    <button
      type="button"
      className="inline-flex size-8 items-center justify-center rounded-[var(--radius-btn)] text-[var(--color-ink)] hover:bg-[var(--fill-subtle)]"
      aria-label="Toggle colour theme"
      aria-pressed={dark}
      suppressHydrationWarning
      onClick={toggle}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
