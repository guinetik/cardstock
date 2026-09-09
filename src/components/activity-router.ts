"use client";

import { useRouter } from "next/navigation";
import { useContext, useMemo, useTransition } from "react";
import { usePendingActivity } from "./activity";
import { NavigationContext } from "./navigation-activity";

export function useActivityRouter(): ReturnType<typeof useRouter> {
  const router = useRouter();
  const [pending, start] = useTransition();
  const navigate = useContext(NavigationContext) ?? start;
  usePendingActivity(pending, "loading");
  return useMemo(
    () => ({
      ...router,
      push: (...args: Parameters<typeof router.push>) =>
        navigate(() => router.push(...args)),
      replace: (...args: Parameters<typeof router.replace>) =>
        navigate(() => router.replace(...args)),
      refresh: () => navigate(() => router.refresh()),
    }),
    [router, navigate],
  );
}
