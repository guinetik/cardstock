import React from "react";

/**
 * A project drawn as a dossier: manila stock, a single tab carrying the
 * project's name, and the way in. Pointing at the tab lifts the whole folder.
 * `section` is the quieter chapter variant used down a project page — same
 * manila, a Plex tab, and no lift.
 */
export function Folder({
  name,
  href,
  count,
  section = false,
  empty = false,
  aside,
  as: Tag = "li",
  className = "",
  children,
  ...rest
}) {
  const Tab = section ? "span" : href ? "a" : "span";
  return (
    <Tag
      {...rest}
      className={`folder ${section ? "folder--section" : ""} ${empty ? "folder--empty" : ""} ${className}`.replace(/\s+/g, " ").trim()}
    >
      <Tab className="folder-tab" href={section ? undefined : href}>
        {section ? <h2>{name}</h2> : <span>{name}</span>}
        {count != null && (
          <>
            <span className="folder-tab-dot">·</span>
            <span className="folder-count">{count}</span>
          </>
        )}
      </Tab>
      <div className="folder-body">
        {children}
        {aside && <div className="folder-aside">{aside}</div>}
      </div>
    </Tag>
  );
}
