"use client";

import { useActionState, useState } from "react";
import { createCliToken, revokeCliToken } from "./actions";

export interface CliTokenRow {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toISOString().slice(0, 10) : "—";

function CopyPlaintext({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="paper-link text-sm"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(
          () => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          },
          () => undefined,
        );
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** The plaintext is client state from the mint action and vanishes on reload. */
export function CliTokens({ tokens }: { tokens: CliTokenRow[] }) {
  const [minted, mint, minting] = useActionState(createCliToken, null);
  const [revoked, revoke] = useActionState(revokeCliToken, null);
  return (
    <div className="roster">
      <form
        action={mint}
        className="binder binder--wide roster-slip roster-slip--blank"
      >
        <span className="binder-rivets" aria-hidden="true" />
        <div className="roster-invite">
          <div>
            <p className="roster-invite-kicker">Mint a token</p>
            <p className="roster-invite-lead">
              A named key for the CLI. The secret is shown once, then gone.
            </p>
          </div>
          <div className="token-fields">
            <label htmlFor="cli-token-name">
              <span>Name</span>
              <input
                id="cli-token-name"
                name="name"
                required
                placeholder="laptop"
                autoComplete="off"
              />
            </label>
            <label htmlFor="cli-token-days">
              <span>Expires</span>
              <span className="token-hint">days · 0 never</span>
              <input
                id="cli-token-days"
                name="days"
                type="number"
                min={0}
                max={3650}
                defaultValue={0}
              />
            </label>
            <button
              type="submit"
              className="roster-invite-go"
              disabled={minting}
            >
              {minting ? "Minting…" : "Mint token"}
            </button>
          </div>
        </div>
      </form>
      {minted?.error ? (
        <p className="identity-note text-[var(--pen-red)]" role="alert">
          {minted.error}
        </p>
      ) : null}
      {minted?.plaintext ? (
        <output className="token-secret">
          <div>
            <strong>Copy this now — it will not be shown again.</strong>
            <code>{minted.plaintext}</code>
          </div>
          <CopyPlaintext value={minted.plaintext} />
        </output>
      ) : null}
      {revoked?.success ? (
        <output className="identity-note">{revoked.success}</output>
      ) : null}
      {tokens.length ? (
        <ul className="roster-slips" aria-label="CLI tokens">
          {tokens.map((token) => (
            <li key={token.id} className="binder binder--wide token-slip">
              <span className="binder-rivets" aria-hidden="true" />
              <div className="roster-who">
                <span className="roster-name">{token.name}</span>
                <code className="roster-mail">cst_{token.id}…</code>
                <span className="token-when">
                  created {when(token.created_at)} · last used{" "}
                  {when(token.last_used_at)} · expires{" "}
                  {token.expires_at ? when(token.expires_at) : "never"}
                </span>
              </div>
              <div className="roster-meta">
                <form action={revoke}>
                  <input type="hidden" name="id" value={token.id} />
                  <button
                    type="submit"
                    className="paper-link paper-link--danger"
                    aria-label={`Revoke ${token.name}`}
                  >
                    Revoke
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="identity-note">No CLI tokens yet.</p>
      )}
    </div>
  );
}
