"use client";

import NextLink, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { usePendingActivity } from "./activity";
import { useActivityRouter } from "./activity-router";

function LinkActivity() {
  const { pending } = useLinkStatus();
  usePendingActivity(pending, "loading");
  return null;
}

/** Next owns navigation, cancellation, modifier keys, prefetch and link refs. */
export default function Link({
  children,
  onNavigate,
  ...props
}: ComponentProps<typeof NextLink>) {
  const router = useActivityRouter();
  return (
    <NextLink
      {...props}
      onNavigate={(event) => {
        let prevented = false;
        onNavigate?.({
          preventDefault() {
            prevented = true;
            event.preventDefault();
          },
        });
        if (prevented) return;
        const href = props.as ?? props.href;
        // Keep Next's URL-object handling; all app destinations are strings.
        if (typeof href !== "string") return;
        event.preventDefault();
        router[props.replace ? "replace" : "push"](href, {
          scroll: props.scroll,
        });
      }}
    >
      {children}
      <LinkActivity />
    </NextLink>
  );
}
