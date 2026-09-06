/**
 * A Lucide glyph, rendered inline — the same icon set, version (v1.34.0) and
 * 2px stroke cardstock imports from `lucide-react`, and it inherits its ink
 * from the text beside it.
 *
 * @startingPoint section="Foundations" subtitle="Lucide glyphs, inheriting ink from their text" viewport="700x150"
 */
export interface IconProps {
  /**
   * kebab-case Lucide name. The set is exactly the glyphs cardstock uses:
   * arrow-left, arrow-right, book, calendar-clock, check, chevron-down,
   * chevron-left, chevron-right, chevron-up, columns-3, download, ellipsis
   * (alias more-horizontal), flag, gauge, grip-vertical, inbox, maximize-2,
   * minus, moon, paperclip, palette, pencil, pin, pin-off, plus, rocket,
   * settings, sun, trash-2, upload, x.
   */
  name: string;
  /** Square edge in px. cardstock uses 13 on card chrome, 14 in toolbars. */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export declare function Icon(props: IconProps): JSX.Element | null;

/** The raw lucide node table, keyed by icon name. */
export declare const LUCIDE_NODES: Record<string, [string, Record<string, string>][]>;
