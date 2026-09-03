# Issue comments (card page)

The card route `/p/[project]/b/[board]/c/[externalId]` splits `cards.body_md` with `splitIssueBody` so the article is issue markdown only. Parsed comments and leftover text render below the article, before History.

## Thread

`IssueComments` (`src/app/p/[project]/b/[board]/c/[externalId]/issue-comments.tsx`) is an append-only client section:

- Heading **Comments**, `data-testid="comment-thread"` for parsed blocks (`at`, `author`, Gravatar portrait, unquoted markdown via `marked`).
- Optional leftover (`data-testid="comment-leftover"`) for unparsed tail after `## Comments`.
- Composer (`data-testid="comment-composer"`) shows the signed-in member's portrait beside the textarea; **Post** (`data-testid="post-comment"`) calls `addCardComment`. Empty input stays on the client (`Write a comment first.`). Success clears the composer and `router.refresh()`.

Comments are not edited in the article. Body WYSIWYG is a separate task.
