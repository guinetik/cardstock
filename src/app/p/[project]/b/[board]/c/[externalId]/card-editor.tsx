"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  archiveCard,
  assignCard,
  setCardTags,
  updateCard,
} from "@/app/p/[project]/b/[board]/actions";
import { assignCardEpic } from "@/app/p/[project]/b/[board]/cockpit/actions";
import { CardColorPicker } from "@/components/board/card-color-picker";
import { Button } from "@/components/ui/button";
import { findPerson, type Person, personLabel } from "@/lib/assignee";
import { type CardColor, parseCardColor } from "@/lib/card-color";
import { CARD_STATUSES, normalizeNeeds } from "@/lib/card-status";
import { markHue } from "@/lib/types";

interface CardLite {
  id: string;
  external_id: string;
  status: string;
  summary: string | null;
  priority: number | null;
  effort: string | null;
  planned_start_date: string | null;
  target_date: string | null;
  target_label: string | null;
  /** Free-text blocker note; anything here marks the card blocked. */
  needs: string | null;
  audience: string;
  archived_at: string | null;
  /** Pastel tint, or null for the neutral paper surface. */
  color: CardColor | null;
  /** Frontmatter `area`; the scheme requires one, "general" is the default. */
  area: string;
  epic_id: string | null;
  assignee_id: string | null;
  assignee: string | null;
}

const field =
  "h-8 w-full rounded-[var(--radius-input)] border border-[var(--border-input)] bg-[var(--surface-input)] px-2.5 text-sm text-[var(--color-ink)]";
const fieldLabel =
  "mb-1 block text-[10px] font-semibold uppercase tracking-[0.11em] text-[var(--color-grey)]";

/** Sentinel value for the "not on this project" option, so it never collides with Unassigned's `""`. */
const OFF_ROSTER = "__off_roster__";

/**
 * Inline editor for summary, status, ratings, dates, the blocker note,
 * audience, color, and tags.
 * Saves on blur/change; lives on the card page as part of the one sheet.
 * Tag groups rest as marked tags only; Edit tags opens the catalog.
 *
 * @param props.card - Subset of card fields the editor mutates.
 * @param props.groups - Tag groups with their tags.
 * @param props.tagIds - Currently assigned tag ids.
 * @param props.backHref - Board URL for "Back to board".
 */
export function CardEditor({
  card,
  groups,
  tagIds,
  epics,
  people,
  backHref,
}: {
  card: CardLite;
  groups: { id: string; name: string; tags: { id: string; name: string }[] }[];
  tagIds: string[];
  epics: { id: string; source_name: string }[];
  people: Person[];
  backHref: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState(card.summary ?? "");
  const [needs, setNeeds] = useState(card.needs ?? "");
  const [tags, setTags] = useState(new Set(tagIds));
  const [editingTags, setEditingTags] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const assigned =
    people.find((p) => p.memberId === card.assignee_id) ??
    findPerson(people, card.assignee);
  const offRoster = !assigned && card.assignee ? card.assignee : null;

  /**
   * Persist a partial card update and refresh the page.
   *
   * @param patch - Fields to send to `updateCard`.
   */
  function save(patch: Parameters<typeof updateCard>[1]) {
    start(async () => {
      const r = await updateCard(card.id, patch);
      setMsg(r.ok ? "Saved" : r.error);
      router.refresh();
    });
  }

  /**
   * Toggle a tag on this card and persist the new set.
   *
   * @param id - Tag id to add or remove.
   */
  function toggleTag(id: string) {
    const n = new Set(tags);
    n.has(id) ? n.delete(id) : n.add(id);
    setTags(n);
    start(async () => {
      const r = await setCardTags(card.id, [...n]);
      setMsg(r.ok ? "Saved" : r.error);
      router.refresh();
    });
  }

  return (
    <div className="mt-6 space-y-5">
      <div>
        <label className={fieldLabel} htmlFor="summary">
          Summary — in plain words
        </label>
        <textarea
          id="summary"
          className="min-h-24 w-full rounded-[var(--radius-input)] border border-[var(--border-input)] bg-[var(--surface-input)] p-3 text-sm text-[var(--color-ink)]"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onBlur={() => summary !== (card.summary ?? "") && save({ summary })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label>
          <span className={fieldLabel}>Status</span>
          <select
            className={field}
            defaultValue={card.status}
            disabled={pending}
            onChange={(e) => save({ status: e.target.value })}
          >
            {CARD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={fieldLabel}>Epic</span>
          <select
            className={field}
            defaultValue={card.epic_id ?? ""}
            disabled={pending}
            onChange={(e) =>
              start(async () => {
                const r = await assignCardEpic(card.id, e.target.value || null);
                setMsg(r.ok ? "Saved" : r.error);
                router.refresh();
              })
            }
          >
            <option value="">Unassigned</option>
            {epics.map((epic) => (
              <option key={epic.id} value={epic.id}>
                {epic.source_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={fieldLabel}>Assignee</span>
          <select
            className={field}
            defaultValue={assigned?.memberId ?? (offRoster ? OFF_ROSTER : "")}
            disabled={pending}
            onChange={(e) =>
              start(async () => {
                const value = e.target.value;
                if (value === OFF_ROSTER) return;
                const r = await assignCard(card.id, value || null);
                setMsg(r.ok ? "Saved" : r.error);
                router.refresh();
              })
            }
          >
            <option value="">Unassigned</option>
            {people.map((person) => (
              <option key={person.memberId} value={person.memberId}>
                {personLabel(person)}
              </option>
            ))}
            {offRoster && (
              // The file names somebody who is not on this project. It gets a
              // value of its own — sharing `""` with Unassigned would make the
              // browser select Unassigned instead, and the next save would
              // quietly erase what the file says.
              <option value={OFF_ROSTER} disabled>
                {offRoster} · not on this project
              </option>
            )}
          </select>
        </label>
        <label>
          <span className={fieldLabel}>Area</span>
          <input
            type="text"
            className={field}
            defaultValue={card.area}
            placeholder="general"
            onBlur={(e) => {
              const next = e.target.value.trim() || "general";
              if (next !== card.area) save({ area: next });
            }}
          />
        </label>
        <label>
          <span className={fieldLabel}>Priority</span>
          <select
            className={field}
            defaultValue={card.priority ?? ""}
            onChange={(e) =>
              save({
                priority: e.target.value
                  ? (Number(e.target.value) as 1 | 2 | 3)
                  : null,
              })
            }
          >
            <option value="">—</option>
            <option value="1">P1</option>
            <option value="2">P2</option>
            <option value="3">P3</option>
          </select>
        </label>
        <label>
          <span className={fieldLabel}>Effort</span>
          <select
            className={field}
            defaultValue={card.effort ?? ""}
            onChange={(e) =>
              save({
                effort: (e.target.value || null) as "L" | "M" | "H" | null,
              })
            }
          >
            <option value="">—</option>
            <option value="L">Low</option>
            <option value="M">Medium</option>
            <option value="H">High</option>
          </select>
        </label>
        <label>
          <span className={fieldLabel}>Audience</span>
          <select
            className={field}
            defaultValue={card.audience}
            onChange={(e) =>
              save({ audience: e.target.value as "all" | "internal" })
            }
          >
            <option value="all">Everyone</option>
            <option value="internal">Internal only</option>
          </select>
        </label>
        <label>
          <span className={fieldLabel}>Planned start</span>
          <input
            type="date"
            className={`${field} font-mono`}
            defaultValue={card.planned_start_date ?? ""}
            onChange={(e) =>
              save({ planned_start_date: e.target.value || null })
            }
          />
        </label>
        <label>
          <span className={fieldLabel}>Target</span>
          <input
            type="date"
            className={`${field} font-mono`}
            defaultValue={card.target_date ?? ""}
            onChange={(e) => save({ target_date: e.target.value || null })}
          />
        </label>
        <label>
          <span className={fieldLabel}>Rough date</span>
          <input
            type="text"
            className={field}
            defaultValue={card.target_label ?? ""}
            placeholder="after new hire"
            onBlur={(e) =>
              e.target.value !== (card.target_label ?? "") &&
              save({ target_label: e.target.value || null })
            }
          />
        </label>
        <label className="sm:col-span-2 lg:col-span-2">
          <span className={fieldLabel}>Waiting on</span>
          <input
            type="text"
            className={field}
            value={needs}
            placeholder="a person, a decision, another team"
            aria-describedby="needs-hint"
            onChange={(e) => setNeeds(e.target.value)}
            onBlur={() => {
              // Show what is actually stored: a note of only spaces is none.
              const next = normalizeNeeds(needs);
              setNeeds(next ?? "");
              if (next !== card.needs) save({ needs: next });
            }}
          />
          <span
            id="needs-hint"
            className="mt-1 block text-[11px] text-[var(--color-grey)]"
          >
            Anything here marks the card blocked. Clear it to unblock.
          </span>
        </label>
      </div>
      <div>
        <span className={fieldLabel}>Color</span>
        <CardColorPicker
          value={parseCardColor(card.color)}
          onChange={(next) => save({ color: next })}
          disabled={pending}
          label={`Color for card #${card.external_id}`}
        />
      </div>
      <div className="space-y-2">
        {groups.map((g, i) => {
          // Each group keeps its own highlighter; unassigned tags rest under
          // a pencil rule, so tagging is picking the marker up and putting it down.
          const hue = markHue(i);
          const shown = editingTags
            ? g.tags
            : g.tags.filter((t) => tags.has(t.id));
          if (!shown.length) return null;
          return (
            <div
              key={g.id}
              className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-x-3"
            >
              <span className="pt-0.5 text-[10px] font-semibold uppercase tracking-[0.11em] text-[var(--color-grey)]">
                {g.name}
              </span>
              <div className="flex flex-wrap gap-x-1.5 gap-y-1">
                {shown.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={tags.has(t.id)}
                    onClick={() => toggleTag(t.id)}
                    className={`mark mark--${hue} ${tags.has(t.id) ? "" : "mark--off"}`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <button
          type="button"
          className="paper-link text-xs"
          aria-expanded={editingTags}
          onClick={() => setEditingTags((open) => !open)}
        >
          {editingTags ? "Done" : "Edit tags"}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant={card.archived_at ? "default" : "outline"}
          size="sm"
          className={
            card.archived_at
              ? undefined
              : "border-[var(--border-hairline)] bg-[var(--surface-input)]"
          }
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await archiveCard(card.id, !card.archived_at);
              setMsg(
                r.ok ? (card.archived_at ? "Restored" : "Archived") : r.error,
              );
              router.refresh();
            })
          }
        >
          {card.archived_at ? "Restore" : "Archive"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => router.push(backHref)}>
          Back to board
        </Button>
        {msg && (
          <output className="text-xs text-[var(--color-grey)]">{msg}</output>
        )}
      </div>
    </div>
  );
}
