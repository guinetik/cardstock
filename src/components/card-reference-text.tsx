import { cardReferenceHref, cardReferenceParts } from "@/lib/card-references";

/** Plain-text prose with board-local `#123` references linked to card pages. */
export function CardReferenceText({
  children,
  boardPath,
}: {
  children: string;
  boardPath: string;
}) {
  return cardReferenceParts(children).map((part, index) =>
    part.type === "text" ? (
      part.value
    ) : (
      <a
        // Repeated references are valid, so their position disambiguates keys.
        key={`${part.externalId}-${index}`}
        href={cardReferenceHref(boardPath, part.externalId)}
        className="paper-link"
        data-card-reference={part.externalId}
      >
        #{part.externalId}
      </a>
    ),
  );
}
