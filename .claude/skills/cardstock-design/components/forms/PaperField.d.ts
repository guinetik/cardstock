/**
 * A field on a printed form — white stock, one ruled edge, 2px corners.
 *
 * @startingPoint section="Forms" subtitle="Text, date and select fields with legends" viewport="700x160"
 */
export interface PaperFieldProps {
  /** `input` (default), `select` or `textarea`. */
  as?: "input" | "select" | "textarea";
  /** Dates, ids and keys are set in Plex Mono. */
  mono?: boolean;
  type?: string;
  value?: string | number;
  placeholder?: string;
  onChange?: React.ChangeEventHandler;
  "aria-label"?: string;
  className?: string;
  children?: React.ReactNode;
}

export declare function PaperField(props: PaperFieldProps): JSX.Element;

/** A cluster of controls as a fieldset, its legend notching the rule. */
export interface FieldsetProps {
  /** The question the cluster asks: Tags, Priority, Effort, Also show. */
  legend: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export declare function Fieldset(props: FieldsetProps): JSX.Element;

/** The uppercase label in a card form's margin gutter. */
export interface FieldLabelProps {
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  children?: React.ReactNode;
}

export declare function FieldLabel(props: FieldLabelProps): JSX.Element;
