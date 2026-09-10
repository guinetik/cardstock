"use client";

import { composeChecklist, parseChecklist } from "@cardstock/core";
import { ArrowDown, ArrowUp, Plus, Trash2, TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { useActivityActionState as useActionState } from "@/components/activity";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type CardStencil,
  STENCIL_NAME_MAX,
  type StencilTagGroup,
  stencilTemplateBody,
} from "@/lib/stencils";
import { markHue } from "@/lib/types";
import { type StencilResult, saveStencil } from "./actions";

const IssueBodyEditor = dynamic(
  () => import("./b/[board]/c/[externalId]/issue-body-editor"),
  { ssr: false },
);
const label =
  "mb-1 block text-[10px] font-semibold uppercase tracking-[0.11em] text-[var(--color-grey)]";
const field =
  "h-8 w-full rounded-[var(--radius-input)] border border-[var(--border-input)] bg-[var(--surface-input)] px-2.5 text-sm text-[var(--color-ink)]";

export function StencilDialog(props: {
  stencil: CardStencil;
  projectSlug: string;
  boardSlug: string;
  groups: StencilTagGroup[];
  cardTemplate: string;
  onClose: () => void;
}) {
  const [original, setOriginal] = useState(props.stencil.body_md);
  const parsed = parseChecklist(original);
  const [body, setBody] = useState(parsed.body);
  const [steps, setSteps] = useState(() =>
    parsed.items.map((item, id) => ({ id, label: item.label })),
  );
  const nextId = useRef(steps.length);
  const focusStepId = useRef<number | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateNotice, setTemplateNotice] = useState<string | null>(null);
  const [tags, setTags] = useState(() => new Set(props.stencil.tag_ids));
  const [state, save, saving] = useActionState(
    async (
      _previous: StencilResult,
      form: FormData,
    ): Promise<StencilResult> => {
      try {
        if (parseChecklist(body).present)
          return {
            error: "Use the checklist step inputs for checklist items.",
          };
        if (
          steps.some((step) => !step.label.trim() || /[\r\n]/.test(step.label))
        )
          return { error: "Give every step a single-line label." };
        form.set(
          "body",
          composeChecklist(
            body,
            {
              present: parsed.present || steps.length > 0,
              items: steps.map((step) => ({
                label: step.label.trim(),
                completed: false,
              })),
            },
            original,
          ),
        );
        const result = await saveStencil(null, form);
        if (!result?.error) props.onClose();
        return result;
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : "Could not save the stencil.",
        };
      }
    },
    null,
  );

  function startFromCardTemplate() {
    setTemplateError(null);
    setTemplateNotice(null);
    try {
      // Parse before replacing any draft state so failed imports are atomic.
      const templateBody = stencilTemplateBody(props.cardTemplate);
      const source = parseChecklist(templateBody);
      setOriginal(templateBody);
      setBody(source.body);
      setSteps(
        source.items.map((item) => ({
          id: nextId.current++,
          label: item.label,
        })),
      );
      setEditorKey((key) => key + 1);
      if (templateBody !== props.cardTemplate)
        setTemplateNotice(
          "Checklist formatting was corrected for this import. Review the steps below; they all start unchecked. Your board's card template is unchanged.",
        );
    } catch (error) {
      setTemplateError(
        "The board's card template could not be loaded. " +
          (error instanceof Error
            ? error.message
            : "Check the template's Markdown.") +
          " Edit the board's card template, or write the description and steps here.",
      );
    }
  }
  function moveStep(index: number, delta: number) {
    setSteps((current) => {
      const next = [...current];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  }

  function addStep(afterId?: number) {
    const step = { id: nextId.current++, label: "" };
    focusStepId.current = step.id;
    setSteps((current) => {
      const at =
        afterId === undefined
          ? current.length
          : current.findIndex((item) => item.id === afterId) + 1;
      return [...current.slice(0, at), step, ...current.slice(at)];
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) props.onClose();
      }}
    >
      <DialogContent className="card-create-sheet sm:max-w-4xl">
        <form
          action={save}
          className="contents"
          data-saving={saving || undefined}
        >
          <input type="hidden" name="stencilId" value={props.stencil.id} />
          <input type="hidden" name="projectSlug" value={props.projectSlug} />
          <input type="hidden" name="boardSlug" value={props.boardSlug} />
          <DialogHeader className="card-create-masthead">
            <DialogTitle>Edit stencil</DialogTitle>
            <DialogDescription>
              A starting point for new cards. Cards already stamped keep their
              own text and checklist.
            </DialogDescription>
          </DialogHeader>
          <div className="card-create-body">
            <div className="card-create-main grid lg:grid-cols-[minmax(0,1fr)_17rem]">
              <div className="card-create-writing grid gap-5 p-5 sm:p-6">
                <label>
                  <span className={label}>Stencil name</span>
                  <input
                    name="name"
                    className={field}
                    defaultValue={props.stencil.name}
                    maxLength={STENCIL_NAME_MAX}
                    required
                    disabled={saving}
                  />
                </label>
                <label>
                  <span className={label}>Default card title</span>
                  <input
                    name="title"
                    className="card-create-title"
                    defaultValue={props.stencil.title ?? ""}
                    maxLength={240}
                    disabled={saving}
                    placeholder="What kind of work is this?"
                  />
                </label>
                <label className="card-create-note">
                  <span className={label}>Summary</span>
                  <textarea
                    name="summary"
                    className="min-h-16 w-full resize-y bg-transparent text-sm leading-6 outline-none"
                    defaultValue={props.stencil.summary ?? ""}
                    disabled={saving}
                  />
                </label>
                <div className="card-create-description">
                  <span className={label}>Description</span>
                  {!body.trim() && !steps.length && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={startFromCardTemplate}
                      disabled={saving}
                    >
                      Start from the board's card template
                    </Button>
                  )}
                  {templateError && (
                    <div
                      role="alert"
                      className="my-3 flex items-start gap-3 rounded-[var(--radius-input)] border border-[var(--pen-red)] bg-[color-mix(in_srgb,var(--pen-red)_8%,var(--surface-panel))] p-3 text-sm"
                    >
                      <TriangleAlert
                        size={18}
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-[var(--pen-red)]"
                      />
                      <div>
                        <p className="mb-1 font-semibold text-[var(--pen-red)]">
                          Check the template's checklist
                        </p>
                        <p className="text-[var(--color-ink)]">
                          {templateError}
                        </p>
                      </div>
                    </div>
                  )}
                  {templateNotice && (
                    <output className="my-3 flex items-start gap-3 rounded-[var(--radius-input)] border border-[var(--pen-amber)] bg-[color-mix(in_srgb,var(--pen-amber)_10%,var(--surface-panel))] p-3 text-sm">
                      <TriangleAlert
                        size={18}
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-[var(--pen-amber)]"
                      />
                      <span>
                        <span className="mb-1 block font-semibold text-[var(--pen-amber)]">
                          Review the imported checklist
                        </span>
                        <span className="text-[var(--color-ink)]">
                          {templateNotice}
                        </span>
                      </span>
                    </output>
                  )}
                  <IssueBodyEditor
                    key={editorKey}
                    markdown={body}
                    onChange={setBody}
                  />
                </div>
                <section aria-labelledby="stencil-checklist-heading">
                  <h3 id="stencil-checklist-heading" className={label}>
                    Checklist
                  </h3>
                  <p className="mb-3 text-xs text-[var(--color-grey)]">
                    Steps start unchecked on every new card.
                  </p>
                  <ol className="grid gap-2">
                    {steps.map((step, index) => (
                      <li key={step.id} className="flex items-center gap-1">
                        <span
                          aria-hidden="true"
                          className="px-1 text-[var(--color-grey)]"
                        >
                          □
                        </span>
                        <input
                          aria-label={`Step ${index + 1}`}
                          ref={(input) => {
                            if (input && focusStepId.current === step.id) {
                              input.focus();
                              focusStepId.current = null;
                            }
                          }}
                          className={field}
                          value={step.label}
                          required
                          disabled={saving}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            if (
                              event.nativeEvent.isComposing ||
                              event.repeat ||
                              !step.label.trim()
                            )
                              return;
                            addStep(step.id);
                          }}
                          onChange={(event) =>
                            setSteps((current) =>
                              current.map((item) =>
                                item.id === step.id
                                  ? { ...item, label: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Move step ${index + 1} up`}
                          disabled={saving || index === 0}
                          onClick={() => moveStep(index, -1)}
                        >
                          <ArrowUp size={14} />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Move step ${index + 1} down`}
                          disabled={saving || index === steps.length - 1}
                          onClick={() => moveStep(index, 1)}
                        >
                          <ArrowDown size={14} />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Remove step ${index + 1}`}
                          disabled={saving}
                          onClick={() =>
                            setSteps((current) =>
                              current.filter((item) => item.id !== step.id),
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </Button>
                      </li>
                    ))}
                  </ol>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    disabled={saving}
                    onClick={() => addStep()}
                  >
                    <Plus size={14} />
                    Add step
                  </Button>
                </section>
              </div>
              <aside className="card-create-sidebar grid content-start gap-4 p-5">
                <p className="border-b border-[var(--border-strong)] pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-grey)]">
                  Filing notes
                </p>
                <label>
                  <span className={label}>Area</span>
                  <input
                    name="area"
                    className={field}
                    defaultValue={props.stencil.area ?? ""}
                    disabled={saving}
                  />
                </label>
                <label>
                  <span className={label}>Effort</span>
                  <select
                    name="effort"
                    className={field}
                    defaultValue={props.stencil.effort ?? ""}
                    disabled={saving}
                  >
                    <option value="">Unestimated</option>
                    <option value="L">Low</option>
                    <option value="M">Medium</option>
                    <option value="H">High</option>
                  </select>
                </label>
              </aside>
            </div>
            <div className="card-create-tags space-y-2 px-5 py-4 sm:px-6">
              {props.groups.map((group, index) => (
                <div
                  key={group.id}
                  className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-x-3"
                >
                  <span className={label}>{group.name}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {group.tags?.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        aria-pressed={tags.has(tag.id)}
                        disabled={saving}
                        className={`mark mark--${markHue(index)} ${tags.has(tag.id) ? "" : "mark--off"}`}
                        onClick={() =>
                          setTags((current) => {
                            const next = new Set(current);
                            next.has(tag.id)
                              ? next.delete(tag.id)
                              : next.add(tag.id);
                            return next;
                          })
                        }
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {[...tags].map((id) => (
                <input key={id} type="hidden" name="tagIds" value={id} />
              ))}
            </div>
            {state?.error && (
              <p role="alert" className="mx-5 my-3 text-sm text-destructive">
                {state.error}
              </p>
            )}
          </div>
          <DialogFooter className="m-0 rounded-none border-[var(--border-divider)] bg-[var(--surface-panel)]">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save stencil"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={props.onClose}
            >
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
