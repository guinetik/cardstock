"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { CARD_TEMPLATE_MAX } from "@/lib/card-template";
import { updateCardTemplate } from "./actions";

/**
 * The board's new-card skeleton: markdown that every card created on the
 * site starts from, so a site-born card carries the same sections the
 * markdown sync's validator demands. Blank means cards start empty.
 */
export function CardTemplateEditor(props: {
  boardId: string;
  projectSlug: string;
  boardSlug: string;
  initial: string;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(updateCardTemplate, null);
  return (
    <form action={action} className="max-w-2xl">
      <input type="hidden" name="boardId" value={props.boardId} />
      <input type="hidden" name="projectSlug" value={props.projectSlug} />
      <input type="hidden" name="boardSlug" value={props.boardSlug} />
      <p className="mb-2 text-sm text-[var(--color-grey)]">
        New cards start with this markdown — the section skeleton your sync
        expects. It pre-fills the create dialog and backs any card created
        without a description. Existing cards are never touched.
      </p>
      <textarea
        name="template"
        aria-label="Card template markdown"
        className="min-h-48 w-full resize-y rounded-[var(--radius-input)] border border-[var(--border-input)] bg-[var(--surface-input)] p-2.5 font-mono text-xs leading-5 text-[var(--color-ink)]"
        defaultValue={props.initial}
        maxLength={CARD_TEMPLATE_MAX}
        placeholder={"## Problem\n\n## Approach\n\n## Done means"}
        disabled={!props.canEdit || pending}
      />
      {state?.error && (
        <p
          className="mt-2 border-l-2 border-[var(--pen-red)] px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}
      {state?.message && (
        <output className="mt-2 block text-sm text-[var(--color-grey)]">
          {state.message}
        </output>
      )}
      <div className="mt-3">
        <Button type="submit" disabled={!props.canEdit || pending}>
          {pending ? "Saving…" : "Save template"}
        </Button>
        {!props.canEdit && (
          <span className="ml-3 text-xs text-[var(--color-grey)]">
            Only an owner or project admin can change this.
          </span>
        )}
      </div>
    </form>
  );
}
