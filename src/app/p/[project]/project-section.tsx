import type { ReactNode } from "react";

/**
 * One chapter of the project page: a quiet folder with a Plex tab.
 */
export function ProjectSection({
  id,
  title,
  count,
  empty = false,
  aside,
  children,
}: {
  id: string;
  title: string;
  count?: string;
  empty?: boolean;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={`folder folder--section${empty ? " folder--empty" : ""}`}
      aria-labelledby={id}
    >
      <div className="folder-tab">
        <h2 id={id}>{title}</h2>
        {count != null && (
          <>
            <span className="folder-tab-dot" aria-hidden="true">
              ·
            </span>
            <span className="folder-count">{count}</span>
          </>
        )}
      </div>
      <div className="folder-body">
        <div className="min-w-0">{children}</div>
        {aside ? <div className="folder-aside">{aside}</div> : null}
      </div>
    </section>
  );
}
