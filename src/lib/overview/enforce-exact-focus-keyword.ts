/** Replaces focus keyword variants in text with the given replacement (used for meta exact match). */
function replaceFocusKeywordVariants(
  text: string,
  focusKeyword: string | undefined,
  replacement: string,
): string {
  if (!text || !focusKeyword?.trim()) return text;
  const exact = focusKeyword.trim();
  let result = text;
  const slugified = exact.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  if (slugified && slugified.length >= 2) {
    const slugRegex = new RegExp(slugified.replace(/-/g, "[-]"), "gi");
    result = result.replace(slugRegex, replacement);
  }
  const words = exact.split(/\s+/).filter(Boolean);
  if (words.length >= 1) {
    const parts = words.map((w) => {
      const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return w.endsWith(".") && escaped.length >= 2 ? `${escaped.slice(0, -2)}\\.?` : escaped;
    });
    const phraseRegex = new RegExp(`\\b${parts.join("\\s+")}\\b`, "gi");
    result = result.replace(phraseRegex, replacement);
  }
  return result;
}

/** Ensures the focus keyword appears exactly as provided (replaces slugified or differently-cased variants). */
export function enforceExactFocusKeyword(text: string, focusKeyword: string | undefined): string {
  return replaceFocusKeywordVariants(text, focusKeyword, focusKeyword?.trim() ?? "");
}
