/** True when generated content is harness HTML (not markdown). */
export function isGeneratedContentHtml(content: string): boolean {
  return /<h2[\s>]/i.test(content ?? "");
}

/** True when content already has block HTML that must not go through markdown regex passes. */
export function contentAlreadyHasBlockHtml(content: string): boolean {
  const t = content ?? "";
  if (/<(?:h2|table|p)\b/i.test(t)) return true;
  return /<div\s+class=["']flo-/i.test(t);
}
