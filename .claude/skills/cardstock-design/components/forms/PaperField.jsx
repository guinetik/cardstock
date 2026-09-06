import React from "react";

/**
 * A field on a printed form: white stock, a 1px ruled edge, 2px corners.
 * Renders `input` by default; `as="select"` and `as="textarea"` share it.
 */
export function PaperField({ as: Tag = "input", mono = false, className = "", children, ...rest }) {
  return (
    <Tag
      {...rest}
      className={`paper-field ${className}`.trim()}
      style={mono ? { fontFamily: "var(--font-mono)", ...rest.style } : rest.style}
    >
      {children}
    </Tag>
  );
}

/**
 * A cluster of controls as a fieldset on a printed form. The legend notches
 * the rule, so a row of abbreviations (P1 P2 P3) always says what it asks.
 */
export function Fieldset({ legend, className = "", children, ...rest }) {
  return (
    <fieldset {...rest} className={`fieldset ${className}`.trim()}>
      <legend>{legend}</legend>
      {children}
    </fieldset>
  );
}

/** The uppercase label in the card form's margin gutter. */
export function FieldLabel({ as: Tag = "span", className = "", children, ...rest }) {
  return (
    <Tag {...rest} className={`field-label ${className}`.trim()}>
      {children}
    </Tag>
  );
}
