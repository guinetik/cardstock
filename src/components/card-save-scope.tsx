"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { createCardSaves } from "@/lib/card-saves";

const SaveContext = createContext<ReturnType<typeof createCardSaves> | null>(
  null,
);

export function CardSaveScope({ children }: { children: ReactNode }) {
  const [saves] = useState(createCardSaves);
  return <SaveContext.Provider value={saves}>{children}</SaveContext.Provider>;
}

export function useCardSaves() {
  const context = useContext(SaveContext);
  const [fallback] = useState(createCardSaves);
  return context ?? fallback;
}

export function useCardDraft(key: string, message: string | null) {
  const saves = useCardSaves();
  useEffect(() => {
    saves.draft(key, message);
    return () => saves.draft(key, null);
  }, [saves, key, message]);
}
