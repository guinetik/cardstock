"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addCardComment } from "@/app/p/[project]/b/[board]/actions";
import { Portrait } from "@/components/portrait";
import { Button } from "@/components/ui/button";
import { renderCardMarkdown } from "@/lib/card-references";
import type { IssueComment } from "@/lib/issue-body";

const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Render comment markdown (already unquoted) to HTML.
 *
 * @param text - Comment body without `>` prefixes.
 */
function commentHtml(text: string, boardPath: string): string {
  return renderCardMarkdown(
    text.replace(
      WIKILINK,
      (_m: string, t: string, l?: string) => `**${l ?? t}**`,
    ),
    boardPath,
  );
}

/**
 * Append-only comments thread and composer for one card.
 *
 * @param props.cardId - Card uuid.
 * @param props.memberEmail - Signed-in member email for the composer portrait.
 * @param props.comments - Parsed comments.
 * @param props.leftover - Unparsed tail of the comments section.
 */
export function IssueComments({
  cardId,
  boardPath,
  memberEmail,
  comments,
  leftover,
}: {
  cardId: string;
  boardPath: string;
  memberEmail: string;
  comments: IssueComment[];
  leftover: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  /**
   * Post the composer value. Empty input stays on the client.
   */
  function post() {
    if (!text.trim()) {
      setMsg("Write a comment first.");
      return;
    }
    start(async () => {
      const r = await addCardComment(cardId, text);
      if (r.ok) {
        setText("");
        setMsg(null);
        router.refresh();
      } else setMsg(r.error);
    });
  }

  return (
    <section className="mt-8 border-t border-[var(--border-hairline)] pt-5">
      <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.11em] text-[var(--color-grey)]">
        Comments
      </h2>
      <ol className="space-y-4" data-testid="comment-thread">
        {comments.map((c) => (
          <li
            key={`${c.at}-${c.author}-${c.text.slice(0, 24)}`}
            className="flex gap-3"
          >
            <Portrait email={c.author} size={36} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[var(--color-grey)]">
                <time className="font-mono">{c.at}</time>
                {" · "}
                {c.author}
              </p>
              <div
                className="prose prose-sm mt-1 max-w-none"
                dangerouslySetInnerHTML={{
                  __html: commentHtml(c.text, boardPath),
                }}
              />
            </div>
          </li>
        ))}
      </ol>
      {leftover ? (
        <div
          className="prose prose-sm mt-4 max-w-none"
          data-testid="comment-leftover"
          dangerouslySetInnerHTML={{
            __html: commentHtml(leftover, boardPath),
          }}
        />
      ) : null}
      <div className="mt-4 flex gap-3">
        <Portrait email={memberEmail} size={36} />
        <div className="min-w-0 flex-1 space-y-2">
          <textarea
            id="comment-composer"
            data-testid="comment-composer"
            className="min-h-20 w-full rounded-[var(--radius-input)] border border-[var(--border-input)] bg-[var(--surface-input)] p-3 text-sm text-[var(--color-ink)]"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment"
          />
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              data-testid="post-comment"
              onClick={post}
            >
              Post
            </Button>
            {msg && (
              <output className="text-xs text-[var(--color-grey)]">
                {msg}
              </output>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
