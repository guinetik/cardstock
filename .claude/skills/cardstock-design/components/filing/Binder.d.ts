/**
 * A board as a binder — riveted spine, name on the cover, keys on the foot.
 *
 * @startingPoint section="Filing" subtitle="Board binder, spine and foot tools" viewport="700x200"
 */
export interface BinderProps {
  /** The board's name, on the cover. */
  name: React.ReactNode;
  /** The cover link — an invisible ::after fills the whole binder. */
  href?: string;
  /** "13 cards", written in the margin under the name. */
  count?: React.ReactNode;
  /** Full-width variant used on a project page, with a `LaneMap` inside. */
  wide?: boolean;
  /** `BinderTool` keys — manage, download, import, Epic Cockpit. */
  tools?: React.ReactNode;
  /** Word links on the foot (Go to Board, Manage, Export CSV). */
  links?: React.ReactNode;
  /** Two shelves of keys instead of one row. */
  stacked?: boolean;
  className?: string;
  /** A `LaneMap` microcosm, on the wide variant. */
  children?: React.ReactNode;
}

export declare function Binder(props: BinderProps): JSX.Element;
