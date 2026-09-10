/**
 * A stencil is one recurring kind of work — "Integration", "New hire" — that a
 * card is stamped from. Its checklist lives inside `body_md` as a `## Checklist`
 * section, so card creation's existing parse path produces the items and there
 * is no second source of truth.
 *
 * Distinct from the board's card template (`@/lib/card-template`), which is the
 * structural floor every card starts from. The template is a constraint; a
 * stencil is a choice.
 */
import { parseChecklist, writeChecklist } from "@cardstock/core";
import { z } from "zod";

export interface CardStencil {
  id: string;
  board_id: string;
  name: string;
  title: string | null;
  summary: string | null;
  body_md: string;
  area: string | null;
  effort: "L" | "M" | "H" | null;
  tag_ids: string[];
}

/** A stencil name is a label in a menu, not a sentence. */
export const STENCIL_NAME_MAX = 80;

/** Same ceiling as the card template: a stencil is a skeleton, not a wiki. */
export const STENCIL_BODY_MAX = 20_000;

export type StencilSeed = {
  title: string;
  summary: string;
  bodyMarkdown: string;
  area: string;
  effort: "L" | "M" | "H" | null;
  tagIds: string[];
};

/**
 * The create dialog's `initialValues` for a stamped card. Deliberately carries
 * no priority: priority is a triage decision relative to the rest of the board
 * at a moment in time, not a property of a kind of work.
 */
export function stencilInitialValues(stencil: CardStencil): StencilSeed {
  return {
    title: stencil.title ?? "",
    summary: stencil.summary ?? "",
    bodyMarkdown: uncheckedStencilBody(stencil.body_md),
    area: stencil.area ?? "",
    effort: stencil.effort,
    tagIds: [...stencil.tag_ids],
  };
}

/** How many steps a stamped card will start with, for the manage list. */
export function stencilStepCount(
  stencil: Pick<CardStencil, "body_md">,
): number {
  return parseChecklist(stencil.body_md).items.length;
}

/** Completed source steps must never produce a pre-completed new card. */
export function uncheckedStencilBody(body: string): string {
  const parsed = parseChecklist(body);
  return writeChecklist(body, {
    present: parsed.present,
    items: parsed.items.map((item) => ({ ...item, completed: false })),
  });
}

/** Accept hand-written checkbox lines when copying a board template. */
export function stencilTemplateBody(template: string): string {
  const parsed = parseChecklist(template, { allowUnbulletedItems: true });
  if (!parsed.present) return template;
  // Normalize only the reserved section; preserve notes and examples elsewhere.
  return uncheckedStencilBody(
    template.slice(0, parsed.start) +
      template
        .slice(parsed.start, parsed.end)
        .replace(/^\[([ xX])\]/gm, "- [$1]") +
      template.slice(parsed.end),
  );
}

export const stencilInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "A stencil needs a name.")
      .max(STENCIL_NAME_MAX, "That name is too long for a menu."),
    title: z.string().trim().max(240),
    summary: z.string().trim(),
    body: z
      .string()
      .max(STENCIL_BODY_MAX, "This stencil is too long to be a skeleton."),
    area: z.string().trim(),
    effort: z.enum(["", "L", "M", "H"]),
    tagIds: z.array(z.uuid()).transform((ids) => [...new Set(ids)]),
  })
  .superRefine((value, ctx) => {
    try {
      parseChecklist(value.body);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        path: ["body"],
        message: error instanceof Error ? error.message : "Invalid checklist.",
      });
    }
  })
  .transform((value) => ({ ...value, body: uncheckedStencilBody(value.body) }));

/** The tag editor needs only labels and identities, not full board card data. */
export interface StencilTagGroup {
  id: string;
  name: string;
  tags: { id: string; name: string }[] | null;
}
