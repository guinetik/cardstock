"use client";

import { useState } from "react";
import { trackActivity } from "@/lib/activity";
import type { NotificationPrefs } from "@/lib/notify";
import { saveNotificationPrefs } from "./actions";

const KINDS = [
  {
    key: "created" as const,
    label: "Card created",
    hint: "A teammate adds a card to a board you have open",
  },
  {
    key: "moved" as const,
    label: "Card moved",
    hint: "An unwatched card changes lanes on the board you have open",
  },
  {
    key: "watchStarted" as const,
    label: "Someone starts watching",
    hint: "A teammate starts watching a card in one of your projects",
  },
  {
    key: "watchedMoved" as const,
    label: "A watched card moves",
    hint: "A card you watch changes lanes, even on another board",
  },
  {
    key: "commented" as const,
    label: "Comment added",
    hint: "Someone comments on a card",
  },
];

/**
 * Master switch plus per-kind opt-outs for board notifications. Turning the
 * switch on is the user gesture browsers require before they will show the
 * permission prompt; a browser-level block is reported, not fought.
 */
export function NotificationSettings({
  initial,
}: {
  initial: NotificationPrefs;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const allEmail = prefs.email.watchStarted && prefs.email.watchedMoved;
  const someEmail = prefs.email.watchStarted || prefs.email.watchedMoved;

  async function save(next: NotificationPrefs) {
    const before = prefs;
    setPrefs(next);
    setBusy(true);
    setNote(null);
    try {
      const result = await trackActivity("saving", () =>
        saveNotificationPrefs(next),
      );
      if (!result.ok) {
        setPrefs(before);
        setNote(result.error);
      }
    } catch {
      setPrefs(before);
      setNote("Could not save your preferences. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(on: boolean) {
    setNote(null);
    if (on) {
      if (typeof Notification === "undefined") {
        setNote("This browser does not support notifications.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNote(
          "The browser is blocking notifications for this site. Allow them in the site settings next to the address bar, then switch this on again.",
        );
        return;
      }
    }
    await save({ ...prefs, enabled: on });
  }

  return (
    <div
      className="prefs"
      data-saving={busy || undefined}
      aria-busy={busy || undefined}
    >
      <label className="pref">
        <input
          type="checkbox"
          checked={prefs.enabled}
          disabled={busy}
          onChange={(event) => void toggleEnabled(event.target.checked)}
        />
        <span>
          <span className="pref-label">Notify me about board activity</span>
          <span className="pref-hint">
            While cardstock is open, watch activity appears as system
            notifications. Other activity is limited to the board you have open.
            Off by default; your own actions never notify you.
          </span>
        </span>
      </label>

      <fieldset className="prefs-kinds" disabled={busy || !prefs.enabled}>
        <legend className="sr-only">Which activity</legend>
        {KINDS.map((kind) => (
          <label
            key={kind.key}
            className={`pref${prefs.enabled ? "" : " opacity-50"}`}
          >
            <input
              type="checkbox"
              checked={prefs.kinds[kind.key]}
              onChange={(event) =>
                void save({
                  ...prefs,
                  kinds: { ...prefs.kinds, [kind.key]: event.target.checked },
                })
              }
            />
            <span>
              <span className="pref-label">{kind.label}</span>
              <span className="pref-hint">{kind.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="pref mt-5">
        <input
          type="checkbox"
          checked={allEmail}
          ref={(input) => {
            if (input) input.indeterminate = someEmail && !allEmail;
          }}
          disabled={busy}
          onChange={(event) =>
            void save({
              ...prefs,
              email: {
                watchStarted: event.target.checked,
                watchedMoved: event.target.checked,
              },
            })
          }
        />
        <span>
          <span className="pref-label">Email notifications</span>
          <span className="pref-hint">
            Check or uncheck all. On by default; these also arrive when
            cardstock is closed.
          </span>
        </span>
      </label>
      <fieldset className="prefs-kinds" disabled={busy}>
        <legend className="sr-only">Email notifications</legend>
        {(
          [
            [
              "watchStarted",
              "Someone starts watching",
              "An email when someone starts watching a card in your project",
            ],
            [
              "watchedMoved",
              "A watched card moves",
              "An email when a card you watch changes lanes",
            ],
          ] as const
        ).map(([key, label, hint]) => (
          <label className="pref" key={key}>
            <input
              type="checkbox"
              checked={prefs.email[key]}
              onChange={(event) =>
                void save({
                  ...prefs,
                  email: { ...prefs.email, [key]: event.target.checked },
                })
              }
            />
            <span>
              <span className="pref-label">{label}</span>
              <span className="pref-hint">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {note && (
        <output className="mt-3 block border-l-2 border-[var(--pen-amber)] px-3 py-2 text-sm">
          {note}
        </output>
      )}
    </div>
  );
}
