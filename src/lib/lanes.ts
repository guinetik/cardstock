/** Turn a display name into the permanent key written to card frontmatter. */
export function laneKeyFromName(name: string): string {
  return name
    .trim()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function cleanLaneName(name: string): string | null {
  const clean = name.trim().replace(/\s+/g, " ");
  return clean.length > 0 && clean.length <= 80 ? clean : null;
}
