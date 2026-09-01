/** Provisional brand line, kept in one place while the wording settles. */
export const CARDSTOCK_SLOGAN = "project zen, on paper";

/** The brand portion shared by every browser title. */
export const CARDSTOCK_TITLE = `cardstock: ${CARDSTOCK_SLOGAN}`;

/** Context shown ahead of the brand on every page inside a board. */
export function boardTitleContext(boardName: string, projectName: string) {
  return `${boardName} | ${projectName}`;
}
