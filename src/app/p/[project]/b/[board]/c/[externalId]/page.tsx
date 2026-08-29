import { CardSheet } from "./card-sheet";

export const dynamic = "force-dynamic";

/**
 * The issue page: the card sheet on its own.
 *
 * @param props - Next.js page props for `/p/[project]/b/[board]/c/[externalId]`.
 */
export default async function CardPage(
  props: PageProps<"/p/[project]/b/[board]/c/[externalId]">,
) {
  const { project, board, externalId } = await props.params;
  const query = await props.searchParams;
  return (
    <CardSheet
      project={project}
      board={board}
      externalId={externalId}
      from={typeof query.from === "string" ? query.from : undefined}
      epic={typeof query.epic === "string" ? query.epic : undefined}
    />
  );
}
