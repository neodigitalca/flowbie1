/** Normalize HTML for equality checks on optimize upload vs live post. */
export function normalizeHtmlForCompare(html: string): string {
  return html.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Extract H2 heading text from HTML (original casing). */
export function extractH2Titles(html: string): string[] {
  const titles: string[] = [];
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const text = match[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) titles.push(text);
  }
  return titles;
}
