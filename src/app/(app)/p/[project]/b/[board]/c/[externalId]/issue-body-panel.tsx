"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { updateCardBody } from "@/app/(app)/p/[project]/b/[board]/actions";
import { useActivityRouter as useRouter } from "@/components/activity-router";
import { useCardDraft, useCardSaves } from "@/components/card-save-scope";
import { Button } from "@/components/ui/button";
import { trackActivity } from "@/lib/activity";

const Editor = dynamic(() => import("./issue-body-editor"), { ssr: false });

/**
 * Issue article: read by default, MDXEditor after Edit.
 *
 * @param props.cardId - Card uuid.
 * @param props.bodyMarkdown - Issue body without comments.
 * @param props.bodyHtml - Rendered read view.
 */
export function IssueBodyPanel({
  cardId,
  bodyMarkdown,
  bodyHtml,
  checklistRevision = 0,
  hasChecklist = false,
}: {
  cardId: string;
  bodyMarkdown: string;
  bodyHtml: string;
  checklistRevision?: number;
  hasChecklist?: boolean;
}) {
  const router = useRouter();
  const saves = useCardSaves();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bodyMarkdown);
  const [editBase, setEditBase] = useState({
    body: bodyMarkdown,
    revision: checklistRevision,
  });
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  useCardDraft(
    "body",
    editing && draft !== bodyMarkdown
      ? "Save or cancel your body edits before downloading."
      : null,
  );

  /**
   * Persist the draft and return to read mode.
   */
  function save() {
    start(async () => {
      const r = await saves.run("body", () =>
        trackActivity(
          "saving",
          () => updateCardBody(cardId, draft, editBase.body, editBase.revision),
          cardId,
        ),
      );
      setMsg(r.ok ? null : r.error);
      if (r.ok) {
        saves.draft("body", null);
        setEditing(false);
        router.refresh();
      }
    });
  }

  /**
   * Preload the editor chunk; stay in read mode if it cannot load.
   */
  function startEdit() {
    import("./issue-body-editor")
      .then(() => {
        setDraft(bodyMarkdown);
        setEditBase({ body: bodyMarkdown, revision: checklistRevision });
        setEditing(true);
      })
      .catch(() => setFailed(true));
  }

  if (failed) {
    return (
      <div className="mt-6">
        <article
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
        <p className="mt-2 text-xs text-[var(--color-grey)]">
          Couldn’t open the editor.
        </p>
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="mt-6">
        <article
          className="prose prose-sm max-w-none"
          data-testid="issue-body"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
        <button
          type="button"
          className="paper-link mt-2 text-xs"
          data-testid="edit-issue-body"
          onClick={startEdit}
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <Editor markdown={draft} onChange={setDraft} />
      {hasChecklist && /^## Checklist\s*$/im.test(draft) && (
        <output className="block text-sm">
          Saving this Checklist section will replace the existing checklist.
        </output>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          data-testid="save-issue-body"
          onClick={save}
        >
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            saves.clear("body");
            setDraft(bodyMarkdown);
            setEditing(false);
            setMsg(null);
          }}
        >
          Cancel
        </Button>
        {msg && (
          <output className="text-xs text-[var(--color-grey)]">{msg}</output>
        )}
      </div>
    </div>
  );
}
