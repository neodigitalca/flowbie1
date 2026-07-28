/** Numeric-only remap when model returns bare WP id and catalog has wp:{n}. */
export function remapBareNumericPostId(id: string, catalogSet: Set<string>): string | null {
  const trimmed = id.trim();
  if (!trimmed || catalogSet.has(trimmed)) return catalogSet.has(trimmed) ? trimmed : null;
  let digits = "";
  for (const ch of trimmed) {
    if (ch >= "0" && ch <= "9") digits += ch;
    else return null;
  }
  if (!digits) return null;
  const candidate = `wp:${digits}`;
  return catalogSet.has(candidate) ? candidate : null;
}

/** Map model postId to a catalog postId (wp:123 vs 123, case-insensitive exact match). */
export function resolveCatalogPostId(
  rawId: string,
  catalogPostIds: Iterable<string>,
): string | null {
  const trimmed = rawId.trim();
  if (!trimmed) return null;
  const catalogSet = new Set(catalogPostIds);
  if (catalogSet.has(trimmed)) return trimmed;
  const bare = remapBareNumericPostId(trimmed, catalogSet);
  if (bare) return bare;
  const lower = trimmed.toLowerCase();
  for (const id of catalogSet) {
    if (id.toLowerCase() === lower) return id;
  }
  return null;
}
