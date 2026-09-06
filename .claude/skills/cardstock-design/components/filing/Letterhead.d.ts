/**
 * The typed briefing sheet a page opens with — eyebrow, title, blurb, view
 * links, and a stamp in the margin.
 *
 * @startingPoint section="Filing" subtitle="Page letterhead with view links" viewport="700x200"
 */
export interface LetterheadProps {
  /** Mono caps above the title — the project name, as a link back. */
  eyebrow?: React.ReactNode;
  /** Set in Newsreader at 1.85rem. */
  title: React.ReactNode;
  blurb?: React.ReactNode;
  /** A row of `PaperLink`s: Epic Cockpit, Calendar, Timeline, Manage. */
  links?: React.ReactNode;
  /** The margin: a `Stamp`, or the page's two ink keys. */
  aside?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export declare function Letterhead(props: LetterheadProps): JSX.Element;

/** A square portrait — filed, not rounded. */
export interface PortraitProps {
  src: string;
  alt?: string;
  /** `sm` 1.25rem, `md` 2.25rem, `topbar` 2.1rem, `lg` 5.5rem. */
  size?: "sm" | "md" | "topbar" | "lg";
  className?: string;
}

export declare function Portrait(props: PortraitProps): JSX.Element;
