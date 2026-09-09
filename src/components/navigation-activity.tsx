"use client";

import {
  createContext,
  type ReactNode,
  type TransitionStartFunction,
  useTransition,
} from "react";
import { usePendingActivity } from "./activity";

export const NavigationContext = createContext<TransitionStartFunction | null>(
  null,
);

/** The transition outlives a menu or card that disappears when clicked. */
export function NavigationActivity({ children }: { children: ReactNode }) {
  const [pending, start] = useTransition();
  usePendingActivity(pending, "loading");
  return (
    <NavigationContext.Provider value={start}>
      {children}
    </NavigationContext.Provider>
  );
}
