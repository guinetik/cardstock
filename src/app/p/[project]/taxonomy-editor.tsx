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

function TagChip({
  tag,
  boardId,
}: {
  tag: TaxonomyGroup["tags"][number];
  boardId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [renameState, rename, renaming] = useRow(renameTag);
  const [removeState, remove, removing] = useRow(deleteTag);

  if (editing)
    return (
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
    );

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border-strong)] px-1.5 py-0.5 text-xs">
      <span>{tag.name}</span>
      <code className="font-mono text-[10px] text-muted-foreground">
        {tag.key}
      </code>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Rename ${tag.name}`}
        className="text-muted-foreground hover:text-foreground"
      >
        <Pencil size={11} />
      </button>
      <form action={remove} className="contents">
        <input type="hidden" name="tagId" value={tag.id} />
        <button
          type="submit"
          disabled={removing}
          aria-label={`Remove ${tag.name}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <X size={12} />
        </button>
      </form>
      <Err state={renameState} />
      <Err state={removeState} />
    </span>
  );
}

function Group({ group, boardId }: { group: TaxonomyGroup; boardId: string }) {
  const [editing, setEditing] = useState(false);
  const [renameState, rename, renaming] = useRow(renameTagGroup);
  const [removeState, remove, removing] = useRow(deleteTagGroup);
  const [addState, add, adding] = useRow(createTag);

  return (
    <li className="paper-card space-y-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
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
              className="h-7 w-48 text-sm"
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
            <span className="font-semibold">{group.name}</span>
            <code className="font-mono text-xs text-muted-foreground">
              {group.key}
            </code>
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Rename group ${group.name}`}
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil size={12} />
            </button>
          </>
        )}
        <form action={remove} className="ml-auto">
          <input type="hidden" name="groupId" value={group.id} />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={removing}
            aria-label={`Remove group ${group.name}`}
          >
            Remove group
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {group.tags.map((t) => (
          <TagChip key={t.id} tag={t} boardId={boardId} />
        ))}
        {group.tags.length === 0 && (
          <span className="text-xs text-muted-foreground">No tags yet.</span>
        )}
      </div>

      <form action={add} className="flex gap-2">
        <input type="hidden" name="groupId" value={group.id} />
        <input type="hidden" name="boardId" value={boardId} />
        <Input
          name="name"
          required
          maxLength={80}
          placeholder="New tag"
          className="h-7 max-w-56 text-xs"
          aria-label={`New tag in ${group.name}`}
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="h-7"
          disabled={adding}
        >
          <Plus size={12} /> Add tag
        </Button>
      </form>
      <Err state={renameState} />
      <Err state={removeState} />
      <Err state={addState} />
    </li>
  );
}

/**
 * Edit the concepts a board sorts its tags into.
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
    <div className="paper-lane space-y-3 p-4">
      <p className="text-sm text-muted-foreground">
        Groups are the filters on{" "}
        <span className="font-medium">{boardName}</span>. A card names a tag by
        its ID in its frontmatter, so IDs never change — names do.
      </p>
      <ul className="space-y-2">
        {groups.map((g) => (
          <Group key={g.id} group={g} boardId={boardId} />
        ))}
      </ul>
      <form action={add} className="flex gap-2">
        <input type="hidden" name="boardId" value={boardId} />
        <Input
          name="name"
          required
          maxLength={80}
          placeholder="New group, e.g. Team"
          className="max-w-64"
          aria-label="New tag group"
        />
        <Button type="submit" disabled={adding}>
          <Plus size={14} /> Add group
        </Button>
      </form>
      <Err state={addState} />
    </div>
  );
}
