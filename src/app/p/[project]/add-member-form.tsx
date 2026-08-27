"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addMember } from "./actions";

export function AddMemberForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(addMember, null);
  return (
    <form action={action} className="flex max-w-md gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <Input
        name="email"
        type="email"
        required
        placeholder="teammate@company.com"
        aria-label="Email to invite"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add member"}
      </Button>
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
    </form>
  );
}
