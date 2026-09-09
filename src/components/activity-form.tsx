"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { usePendingActivity } from "./activity";

function FormActivity() {
  const { pending } = useFormStatus();
  usePendingActivity(pending, "saving");
  return <span hidden data-form-saving={pending ? "true" : undefined} />;
}

/** For server-rendered forms that call actions without a client action hook. */
export function ActivityForm({ children, ...props }: ComponentProps<"form">) {
  return (
    <form {...props}>
      {children}
      <FormActivity />
    </form>
  );
}
