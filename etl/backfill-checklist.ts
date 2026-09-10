/** Preview by default; --apply extracts valid sections from current database bodies. */
import { checklistSection, parseChecklist } from "@cardstock/core";
import { flag, serviceClient } from "./db";

const db = serviceClient();
let cursor = "00000000-0000-0000-0000-000000000000";
let migrated = 0;
let invalid = 0;
for (;;) {
  const { data: cards, error } = await db
    .from("cards")
    .select(
      "id,external_id,body_md,updated_at,checklist_present,checklist_revision,body_edited_at",
    )
    .gt("id", cursor)
    .order("id")
    .limit(200);
  if (error) throw error;
  if (!cards.length) break;
  for (const card of cards) {
    cursor = card.id;
    try {
      const parsed = parseChecklist(card.body_md ?? "");
      if (!parsed.present) continue;
      if (card.checklist_present)
        throw new Error(
          "Body contains a section but this card already has a managed checklist; reconcile manually.",
        );
      if (flag("apply")) {
        const { data: saved, error: writeError } = await db
          .from("cards")
          .update({
            body_md: parsed.body.trim(),
            checklist_input: checklistSection(parsed),
            checklist_expected_revision: card.checklist_revision,
            checklist_edited_at: card.body_edited_at,
          })
          .eq("id", card.id)
          .eq("updated_at", card.updated_at)
          .select("id")
          .maybeSingle();
        if (writeError) throw writeError;
        if (!saved) throw new Error("Card changed; run backfill again.");
      }
      migrated++;
      console.log(
        `${flag("apply") ? "Extracted" : "Would extract"} #${card.external_id} (${card.id}): ${parsed.items.length} checklist items`,
      );
    } catch (error) {
      invalid++;
      console.error(
        `#${card.external_id} (${card.id}): ${(error as Error).message}`,
      );
    }
  }
}
console.log(
  `${migrated} ${flag("apply") ? "extracted" : "eligible"}; ${invalid} need attention.`,
);
if (invalid) process.exitCode = 1;
