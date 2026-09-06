/**
 * The app bar. cardstock has no logo mark; the wordmark is the product name
 * set in Newsreader, lowercase, at 15px.
 *
 * @startingPoint section="Stock" subtitle="App bar with wordmark and user slot" viewport="700x60"
 */
export interface PaperTopbarProps {
  /** Wordmark text. Defaults to "cardstock". */
  brand?: string;
  href?: string;
  /** Right-hand slot — the user menu in the app. */
  right?: React.ReactNode;
  className?: string;
}
export declare function PaperTopbar(props: PaperTopbarProps): JSX.Element;
