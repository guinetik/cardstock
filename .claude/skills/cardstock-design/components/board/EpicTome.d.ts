/**
 * An epic as a closed tome — cloth spine in the outlook pen, page block
 * showing past the cover.
 *
 * @startingPoint section="Board" subtitle="Epic tome, four outlook pens" viewport="700x220"
 */
export interface EpicTomeProps {
  /** Colours the spine: grey when planning, then green, amber, red. */
  outlook?: "planning" | "on-track" | "attention" | "at-risk";
  /** `tile` is the shelved cockpit card; `slip` is the smaller drop target. */
  shape?: "tile" | "slip";
  /** A task is held over it — the spine takes the amber pen. */
  over?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export declare function EpicTome(props: EpicTomeProps): JSX.Element;
