"use client";
import { Check, Pencil, Plus, X } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createTag,
  createTagGroup,
  deleteTag,
  deleteTagGroup,
  renameTag,
  renameTagGroup,
  type TaxonomyResult,
} from "./actions";

export interface TaxonomyGroup {
  id: string;
  key: string;
  name: string;
  /** The highlighter this group is swiped in, from `markHue()`; board order. */
  hue?: number;
  tags: { id: string; key: string; name: string }[];
}

/** One inline form, so every row shares the pending/error handling. */
function useRow(
  action: (p: TaxonomyResult, f: FormData) => Promise<TaxonomyResult>,
) {
  return useActionState<TaxonomyResult, FormData>(action, null);
}

function Err({ state }: { state: TaxonomyResult }) {
  if (!state?.error) return null;
  return (
    <p className="mt-1 text-xs text-destructive" role="alert">
      {state.error}
    </p>
  );
}

/** A leaf on the graph: one tag, swiped in the concept's highlighter. */
function TagLeaf({
  tag,
  boardId,
  hue,
}: {
  tag: TaxonomyGroup["tags"][number];
  boardId: string;
  hue: number;
}) {
  const [editing, setEditing] = useState(false);
  const [renameState, rename, renaming] = useRow(renameTag);
  const [removeState, remove, removing] = useRow(deleteTag);

  if (editing)
    return (
      <li className="graph-leaf">
        <form
          action={rename}
          className="inline-flex items-center gap-1"
          onSubmit={() => setEditing(false)}
        >
          <input type="hidden" name="tagId" value={tag.id} />
          <input type="hidden" name="boardId" value={boardId} />
          <Input
            name="name"
            defaultValue={tag.name}
            required
            maxLength={80}
            className="h-7 w-40 text-xs"
            autoFocus
            aria-label={`Name for ${tag.key}`}
          />
          <Button
            type="submit"
            size="sm"
            className="h-7 px-2"
            disabled={renaming}
            aria-label={`Save name for ${tag.key}`}
          >
            <Check size={12} />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2"
            onClick={() => setEditing(false)}
            aria-label={`Cancel renaming ${tag.key}`}
          >
            <X size={12} />
          </Button>
        </form>
      </li>
    );

  return (
    <li className="graph-leaf">
      <span className={`mark mark--${hue}`}>{tag.name}</span>
      <code className="graph-key">{tag.key}</code>
      <span className="graph-tools">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Rename ${tag.name}`}
        >
          <Pencil size={11} />
        </button>
        <form action={remove} className="contents">
          <input type="hidden" name="tagId" value={tag.id} />
          <button
            type="submit"
            disabled={removing}
            aria-label={`Remove ${tag.name}`}
            data-danger
          >
            <X size={12} />
          </button>
        </form>
      </span>
      <Err state={renameState} />
      <Err state={removeState} />
    </li>
  );
}

/** A concept node and everything that branches from it. */
function Concept({
  group,
  boardId,
}: {
  group: TaxonomyGroup;
  boardId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [renameState, rename, renaming] = useRow(renameTagGroup);
  const [removeState, remove, removing] = useRow(deleteTagGroup);
  const [addState, add, adding] = useRow(createTag);
  const hue = group.hue ?? 2;

  return (
    <li className="graph-row">
      <div className={`graph-node graph-node--${hue}`}>
        {editing ? (
          <form
            action={rename}
            className="flex items-center gap-1"
            onSubmit={() => setEditing(false)}
          >
            <input type="hidden" name="groupId" value={group.id} />
            <Input
              name="name"
              defaultValue={group.name}
              required
              maxLength={80}
              className="h-7 w-36 text-sm"
              autoFocus
              aria-label={`Name for ${group.key}`}
            />
            <Button
              type="submit"
              size="sm"
              className="h-7"
              disabled={renaming}
              aria-label={`Save name for group ${group.key}`}
            >
              Save
            </Button>
          </form>
        ) : (
          <>
            <h3 className="graph-node-name">{group.name}</h3>
            <code className="graph-key">{group.key}</code>
            <span className="graph-tools">
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label={`Rename group ${group.name}`}
              >
                <Pencil size={12} />
              </button>
              <form action={remove} className="contents">
                <input type="hidden" name="groupId" value={group.id} />
                <button
                  type="submit"
                  disabled={removing}
                  aria-label={`Remove group ${group.name}`}
                  data-danger
                >
                  <X size={13} />
                </button>
              </form>
            </span>
          </>
        )}
        <Err state={renameState} />
        <Err state={removeState} />
      </div>
      <span className="graph-edge" aria-hidden="true" />
      <ul className="graph-leaves">
        {group.tags.map((t) => (
          <TagLeaf key={t.id} tag={t} boardId={boardId} hue={hue} />
        ))}
        <li className="graph-leaf graph-leaf--new">
          <form action={add} className="flex items-center gap-1.5">
            <input type="hidden" name="groupId" value={group.id} />
            <input type="hidden" name="boardId" value={boardId} />
            <Input
              name="name"
              required
              maxLength={80}
              placeholder="New tag"
              className="h-7 w-44 text-xs"
              aria-label={`New tag in ${group.name}`}
            />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              className="h-7"
              disabled={adding}
            >
              <Plus size={12} /> Add tag
            </Button>
          </form>
          <Err state={addState} />
        </li>
      </ul>
    </li>
  );
}

/**
 * Edit the concepts a board sorts its cards by, drawn as a graph: each
 * concept is a node, and the tags a card can carry branch from it.
 *
 * These groups are the dropdowns on the board, and the tags in them are what a
 * tracker file is allowed to say: the importer resolves a bare tag by finding
 * the group that declares it, so a tag missing here is dropped on import.
 */
export function TaxonomyEditor({
  boardId,
  boardName,
  groups,
}: {
  boardId: string;
  boardName: string;
  groups: TaxonomyGroup[];
}) {
  const [addState, add, adding] = useRow(createTagGroup);
  return (
    <div className="graph">
      <p className="graph-caption">
        What{" "}
        <span className="font-medium text-[var(--color-ink)]">{boardName}</span>{" "}
        thinks in. Each concept is a filter on the board; every tag branching
        from it is a value a card can carry. Cards name tags by ID, so IDs never
        change — names do.
      </p>
      <ul className="graph-rows">
        {groups.map((g) => (
          <Concept key={g.id} group={g} boardId={boardId} />
        ))}
        <li className="graph-row graph-row--new">
          <form action={add} className="graph-node graph-node--new">
            <input type="hidden" name="boardId" value={boardId} />
            <Input
              name="name"
              required
              maxLength={80}
              placeholder="New concept, e.g. Team"
              className="h-8 w-48"
              aria-label="New tag group"
            />
            <Button type="submit" size="sm" disabled={adding}>
              <Plus size={14} /> Add group
            </Button>
          </form>
          <Err state={addState} />
        </li>
      </ul>
    </div>
  );
}
