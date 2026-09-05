export function dedupeLlmAuditUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const k = u.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

export function urlsFromLlmAuditText(text: string): string[] {
  const matches = text.match(/https:\/\/[^\s)\]"'<>]+/gi) ?? [];
  return matches.map((u) => u.replace(/[.,;:!?)]+$/, ""));
}
