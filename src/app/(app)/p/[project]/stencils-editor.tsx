"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { useActivityActionState as useActionState } from "@/components/activity";
import { Button } from "@/components/ui/button";
import {
  type CardStencil,
  STENCIL_NAME_MAX,
  type StencilTagGroup,
  stencilStepCount,
} from "@/lib/stencils";
import { createStencil, deleteStencil, duplicateStencil } from "./actions";
import { StencilDialog } from "./stencil-dialog";

/**
 * A board's stencils: the reusable card shapes it stamps from. Distinct from
 * the card template above, which every card starts from whether or not a
 * stencil was chosen.
 */
export function StencilsEditor(props: {
  boardId: string;
  projectSlug: string;
  boardSlug: string;
  stencils: CardStencil[];
  groups: StencilTagGroup[];
  cardTemplate: string;
  canEdit: boolean;
}) {
  const [addState, add, adding] = useActionState(createStencil, null);
  const [editing, setEditing] = useState<CardStencil | null>(null);
  return (
    <div className="max-w-2xl">
      <p className="mb-3 text-sm text-[var(--color-grey)]">
        A stencil is a kind of work you make cards for over and over. Stamping
        one fills in the card’s text, its checklist and its tags. Cards already
        stamped are never changed.
      </p>
      <ul className="grid gap-1.5">
        {props.stencils.map((stencil) => (
          <StencilRow
            key={stencil.id}
            stencil={stencil}
            projectSlug={props.projectSlug}
            boardSlug={props.boardSlug}
            canEdit={props.canEdit}
            onEdit={() => setEditing(stencil)}
          />
        ))}
        {!props.stencils.length && (
          <li className="text-sm text-[var(--color-grey)]">
            No stencils yet. New cards start from the card template above.
          </li>
        )}
      </ul>
      {props.canEdit && (
        <form
          action={add}
          data-saving={adding || undefined}
          className="mt-3 flex items-center gap-1.5"
        >
          <input type="hidden" name="boardId" value={props.boardId} />
          <input type="hidden" name="projectSlug" value={props.projectSlug} />
          <input type="hidden" name="boardSlug" value={props.boardSlug} />
          <input
            name="name"
            aria-label="New stencil name"
            placeholder="Integration"
            maxLength={STENCIL_NAME_MAX}
            required
            className="rounded-[var(--radius-input)] border border-[var(--border-input)] bg-[var(--surface-input)] px-2.5 py-1.5 text-sm"
          />
          <Button type="submit" disabled={adding}>
            <Plus size={14} /> Add stencil
          </Button>
        </form>
      )}
      {addState?.error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {addState.error}
        </p>
      )}
      {!props.canEdit && (
        <p className="mt-3 text-xs text-[var(--color-grey)]">
          Only an owner or project admin can change this.
        </p>
      )}
      {editing && (
        <StencilDialog
          key={editing.id}
          stencil={editing}
          projectSlug={props.projectSlug}
          boardSlug={props.boardSlug}
          groups={props.groups}
          cardTemplate={props.cardTemplate}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function StencilRow(props: {
  onEdit: () => void;
  stencil: CardStencil;
  projectSlug: string;
  boardSlug: string;
  canEdit: boolean;
}) {
  const [removeState, remove, removing] = useActionState(deleteStencil, null);
  const [copyState, copy, copying] = useActionState(duplicateStencil, null);
  const busy = removing || copying;
  const steps = stencilStepCount(props.stencil);
  const tags = props.stencil.tag_ids.length;
  return (
    <li className="flex items-center gap-3 border-b border-[var(--rule)] py-1.5">
      <span className="font-medium text-sm">{props.stencil.name}</span>
      <span className="text-xs text-[var(--color-grey)]">
        {steps} {steps === 1 ? "step" : "steps"}
        {tags ? ` · ${tags} ${tags === 1 ? "tag" : "tags"}` : ""}
      </span>
      {props.canEdit && (
        <form action={remove} className="ml-auto flex shrink-0 items-center">
          <input type="hidden" name="stencilId" value={props.stencil.id} />
          <input type="hidden" name="projectSlug" value={props.projectSlug} />
          <input type="hidden" name="boardSlug" value={props.boardSlug} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={props.onEdit}
          >
            Edit
          </Button>
          <Button
            type="submit"
            formAction={copy}
            variant="ghost"
            size="sm"
            disabled={busy}
          >
            {copying ? "Duplicating…" : "Duplicate"}
          </Button>
          <Button type="submit" variant="ghost" size="sm" disabled={busy}>
            Delete
          </Button>
        </form>
      )}
      {removeState?.error && (
        <span className="text-xs text-destructive" role="alert">
          {removeState.error}
        </span>
      )}
      {copyState?.error && (
        <span className="text-xs text-destructive" role="alert">
          {copyState.error}
        </span>
      )}
    </li>
  );
}
