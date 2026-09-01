import type { Metadata } from "next";
import { CardSheet } from "../../../c/[externalId]/card-sheet";
import { CardModal } from "./card-modal";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/p/[project]/b/[board]/c/[externalId]">,
): Promise<Metadata> {
  const { externalId } = await props.params;
  return { title: `Card #${externalId}` };
}

/**
 * A card opened from the board lands here instead of leaving the board: the
 * same sheet as the issue page, in a dialog. A reload of the same URL gives
 * the full page.
 */
export default async function CardModalPage(
  props: PageProps<"/p/[project]/b/[board]/c/[externalId]">,
) {
  const { project, board, externalId } = await props.params;
  return (
    <CardModal>
      <CardSheet
        project={project}
        board={board}
        externalId={externalId}
        inModal
      />
    </CardModal>
  );
}
