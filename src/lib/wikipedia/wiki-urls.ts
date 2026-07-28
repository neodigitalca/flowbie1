/** Public URL for an English Wikipedia article title (spaces → underscores). */
export function wikipediaArticleUrl(title: string): string {
  const t = title.trim();
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(t.replace(/\s+/g, "_"))}`;
}

/** Opens English Wikipedia search in the browser. */
export function wikipediaSearchUrl(query: string): string {
  const q = query.trim();
  if (!q) return "https://en.wikipedia.org/wiki/Main_Page";
  return `https://en.wikipedia.org/w/index.php?title=Special:Search&search=${encodeURIComponent(q)}`;
}
