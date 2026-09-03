"use client";

import { useState } from "react";
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
    hint: "A card changes lanes",
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

  async function save(next: NotificationPrefs) {
    const before = prefs;
    setPrefs(next);
    setBusy(true);
    const result = await saveNotificationPrefs(next);
    setBusy(false);
    if (!result.ok) {
      setPrefs(before);
      setNote(result.error);
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
    <div className="max-w-xl">
      <label className="flex items-baseline gap-2.5">
        <input
          type="checkbox"
          checked={prefs.enabled}
          disabled={busy}
          onChange={(event) => void toggleEnabled(event.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium">
            Notify me about board activity
          </span>
          <span className="block text-xs text-[var(--color-grey)]">
            While a board tab is open, teammates&apos; changes show as system
            notifications. Off by default; your own actions never notify you.
          </span>
        </span>
      </label>

      <fieldset
        className="mt-3 ml-6 grid gap-2 border-l border-[var(--border-hairline)] pl-4"
        disabled={busy || !prefs.enabled}
      >
        <legend className="sr-only">Which activity</legend>
        {KINDS.map((kind) => (
          <label
            key={kind.key}
            className={`flex items-baseline gap-2.5 ${prefs.enabled ? "" : "opacity-50"}`}
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
              <span className="block text-sm">{kind.label}</span>
              <span className="block text-xs text-[var(--color-grey)]">
                {kind.hint}
              </span>
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
