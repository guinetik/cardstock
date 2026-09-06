/**
 * A button written in ink. The primary action in cardstock is never a
 * colour — pen blue is reserved for links and P2.
 *
 * @startingPoint section="Forms" subtitle="Ink, outline, ghost and danger keys" viewport="700x120"
 */
export interface PaperButtonProps {
  /** `ink` is the filled default; `danger` is the red pen, outline only. */
  variant?: "ink" | "outline" | "ghost" | "danger";
  /** `sm` is the 28px-tall control that sits in a letterhead or a toolbar. */
  size?: "md" | "sm";
  /** Render as `a` for a link that looks like a key. */
  as?: keyof JSX.IntrinsicElements;
  disabled?: boolean;
  onClick?: React.MouseEventHandler;
  className?: string;
  children?: React.ReactNode;
}

export declare function PaperButton(props: PaperButtonProps): JSX.Element;

/** The 28-square ink key on a binder's foot. */
export interface BinderToolProps {
  /** Write it in the red pen and let it carry a word (Epic Cockpit). */
  pen?: boolean;
  as?: keyof JSX.IntrinsicElements;
  title?: string;
  "aria-label"?: string;
  className?: string;
  children?: React.ReactNode;
}

export declare function BinderTool(props: BinderToolProps): JSX.Element;
