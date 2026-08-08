/** Strip HTML tags for sentence-end checks (character scan, no regex on HTML). */
export function stripHtmlTagsForSentenceCheck(html: string): string {
  let out = "";
  let inTag = false;
  for (const ch of html) {
    if (ch === "<") {
      inTag = true;
      continue;
    }
    if (ch === ">") {
      inTag = false;
      continue;
    }
    if (!inTag) out += ch;
  }
  return out;
}

export function plainTextEndsWithCompleteSentence(plain: string): boolean {
  const t = plain.trimEnd();
  if (!t) return false;
  return /[.!?]["']?\s*$/.test(t);
}

/**
 * Drop trailing incomplete paragraphs so harness sections never end mid-sentence.
 * Deterministic one-pass trim — not an LLM retry.
 */
export function trimHarnessSectionToCompleteSentences(html: string): string {
  let s = html.trim();
  if (!s) return s;

  const lastOpenP = s.toLowerCase().lastIndexOf("<p");
  const lastCloseP = s.toLowerCase().lastIndexOf("</p>");
  if (lastOpenP > lastCloseP) {
    s = s.slice(0, lastOpenP).trimEnd();
  }

  let changed = true;
  while (changed) {
    changed = false;
    const m = s.match(/([\s\S]*)<p[^>]*>([\s\S]*?)<\/p>\s*$/i);
    if (!m) break;
    const [, head, inner] = m;
    const plain = stripHtmlTagsForSentenceCheck(inner);
    if (plainTextEndsWithCompleteSentence(plain)) break;
    s = head.trimEnd();
    changed = true;
  }

  return s;
}
