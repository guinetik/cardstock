/**
 * A project as a manila dossier — one tab, the blurb, the binders inside.
 *
 * @startingPoint section="Filing" subtitle="Manila dossier with a named tab" viewport="700x260"
 */
export interface FolderProps {
  /** The project's name — the tab is the name and the way in. */
  name: React.ReactNode;
  /** Where the tab goes. Omit on a `section` folder; its tab is not a link. */
  href?: string;
  /** A mono count written beside the tab name. */
  count?: React.ReactNode;
  /** The quieter chapter variant: Plex tab, no hover-lift, tab is an h2. */
  section?: boolean;
  /** Nothing filed yet — the body's edge goes dashed and loses its shadow. */
  empty?: boolean;
  /** The margin of the folder: a `Stamp` and the way in. */
  aside?: React.ReactNode;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  children?: React.ReactNode;
}

export declare function Folder(props: FolderProps): JSX.Element;
