"use client";

import { useActionState, useState } from "react";
import { CARD_STATUSES } from "@/lib/card-status";
import { type BoardGate, GATE_NAME_MAX } from "@/lib/gates";
import { updateBoardGates } from "./actions";

/**
 * Editor for one board's ordered gates, or a read-only name list.
 * Used on the project page (one block per board) and the board manage page.
 */
export function GatesEditor({
  boardId,
  boardSlug,
  projectSlug,
  boardName,
  showBoardName,
  lanes,
  initialGates,
  canEdit,
}: {
  boardId: string;
  boardSlug: string;
  projectSlug: string;
  boardName: string;
  showBoardName: boolean;
  lanes: { id: string; name: string }[];
  initialGates: BoardGate[];
  canEdit: boolean;
}) {
  const headingId = `gates-${boardSlug}-heading`;

  if (!canEdit) {
    return (
      <section
        className="cta"
        {...(showBoardName
          ? { "aria-labelledby": headingId }
          : { "aria-label": "Gates" })}
      >
        <div className="min-w-0">
          {showBoardName ? (
            <h3 id={headingId} className="cta-title">
              {boardName}
            </h3>
          ) : null}
          <ul className="cta-body">
            {initialGates.map((gate) => (
              <li key={gate.id}>{gate.name}</li>
            ))}
          </ul>
        </div>
        <span className="cta-note">Board setting</span>
      </section>
    );
  }

  return (
    <GatesForm
      boardId={boardId}
      boardSlug={boardSlug}
      projectSlug={projectSlug}
      boardName={boardName}
      showBoardName={showBoardName}
      headingId={headingId}
      lanes={lanes}
      initialGates={initialGates}
    />
  );
}

function GatesForm({
  boardId,
  boardSlug,
  projectSlug,
  boardName,
  showBoardName,
  headingId,
  lanes,
  initialGates,
}: {
  boardId: string;
  boardSlug: string;
  projectSlug: string;
  boardName: string;
  showBoardName: boolean;
  headingId: string;
  lanes: { id: string; name: string }[];
  initialGates: BoardGate[];
}) {
  const [state, action, pending] = useActionState(updateBoardGates, null);
  const [gates, setGates] = useState(initialGates);

  function updateGate(id: string, patch: Partial<BoardGate>) {
    setGates((current) =>
      current.map((gate) => (gate.id === id ? { ...gate, ...patch } : gate)),
    );
  }

  function toggleStatus(id: string, status: string, on: boolean) {
    setGates((current) =>
      current.map((gate) => {
        if (gate.id !== id) return gate;
        const statuses = on
          ? [...gate.statuses, status]
          : gate.statuses.filter((value) => value !== status);
        return { ...gate, statuses };
      }),
    );
  }

  function toggleLane(id: string, laneId: string, on: boolean) {
    setGates((current) =>
      current.map((gate) => {
        if (gate.id !== id) return gate;
        const lane_ids = on
          ? [...gate.lane_ids, laneId]
          : gate.lane_ids.filter((value) => value !== laneId);
        return { ...gate, lane_ids };
      }),
    );
  }

  function moveGate(index: number, direction: -1 | 1) {
    setGates((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(target, 0, row!);
      return next;
    });
  }

  return (
    <section
      className="cta"
      {...(showBoardName
        ? { "aria-labelledby": headingId }
        : { "aria-label": "Gates" })}
    >
      <div className="min-w-0">
        {showBoardName ? (
          <h3 id={headingId} className="cta-title">
            {boardName}
          </h3>
        ) : null}
        <p className="cta-body">
          A gate is a milestone. Tick tracker <strong>statuses</strong> and/or
          board <strong>lanes</strong> that belong to it. First match wins.
          Pulse is optional — it fills the Built or Shipped column on the
          timeline.
        </p>
        <form action={action} className="mt-3 space-y-4">
          <input type="hidden" name="boardId" value={boardId} />
          <input type="hidden" name="projectSlug" value={projectSlug} />
          <input type="hidden" name="boardSlug" value={boardSlug} />
          <input type="hidden" name="gates" value={JSON.stringify(gates)} />
          <ul className="space-y-3">
            {gates.map((gate, index) => (
              <li
                key={gate.id}
                className="paper-card paper-card--still space-y-3 p-4"
              >
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-grey)]">
                    Name
                    <input
                      type="text"
                      maxLength={GATE_NAME_MAX}
                      value={gate.name}
                      onChange={(event) =>
                        updateGate(gate.id, { name: event.target.value })
                      }
                      aria-label={
                        gate.name
                          ? `Name for ${gate.name}`
                          : "Name for new gate"
                      }
                      className="paper-field mt-1 block w-56 normal-case tracking-normal"
                    />
                  </label>
                  <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-grey)]">
                    Pulse
                    <select
                      value={gate.outcome ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateGate(gate.id, {
                          outcome:
                            value === "built" || value === "shipped"
                              ? value
                              : null,
                        });
                      }}
                      aria-label={
                        gate.name
                          ? `Pulse for ${gate.name}`
                          : "Pulse for new gate"
                      }
                      className="paper-field mt-1 block min-w-28 normal-case tracking-normal"
                    >
                      <option value="">None</option>
                      <option value="built">Built column</option>
                      <option value="shipped">Shipped column</option>
                    </select>
                  </label>
                </div>
                <fieldset className="fieldset flex-wrap">
                  <legend>Statuses</legend>
                  {CARD_STATUSES.map((status) => (
                    <label
                      key={status}
                      className="inline-flex items-center gap-1 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={gate.statuses.includes(status)}
                        onChange={(event) =>
                          toggleStatus(gate.id, status, event.target.checked)
                        }
                        aria-label={`Status ${status}`}
                      />
                      {status}
                    </label>
                  ))}
                </fieldset>
                <fieldset className="fieldset flex-wrap">
                  <legend>Lanes</legend>
                  {lanes.map((lane) => (
                    <label
                      key={lane.id}
                      className="inline-flex items-center gap-1 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={gate.lane_ids.includes(lane.id)}
                        onChange={(event) =>
                          toggleLane(gate.id, lane.id, event.target.checked)
                        }
                      />{" "}
                      {lane.name}
                    </label>
                  ))}
                </fieldset>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="paper-link text-xs"
                    disabled={index === 0}
                    onClick={() => moveGate(index, -1)}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    className="paper-link text-xs"
                    disabled={index === gates.length - 1}
                    onClick={() => moveGate(index, 1)}
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    className="paper-link paper-link--danger text-xs"
                    onClick={() =>
                      setGates((current) =>
                        current.filter((row) => row.id !== gate.id),
                      )
                    }
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              className="paper-btn"
              onClick={() =>
                setGates((current) => [
                  ...current,
                  {
                    id: crypto.randomUUID(),
                    name: "",
                    statuses: [],
                    lane_ids: [],
                    outcome: null,
                  },
                ])
              }
            >
              Add gate
            </button>
            <button type="submit" className="paper-btn" disabled={pending}>
              {pending ? "Saving…" : "Save gates"}
            </button>
          </div>
          <span
            className={`cta-note ${state?.error ? "text-[var(--pen-red)]" : ""}`}
            aria-live="polite"
          >
            {state?.error ?? state?.message ?? ""}
          </span>
        </form>
      </div>
    </section>
  );
}
