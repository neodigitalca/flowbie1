/**
 * SEO extra text must open with <h2> and include exactly one <h3> before upload.
 */

import { markdownToHtml } from "@/lib/markdown-to-html";

/** Count opening tags like <h2> or <h2 ...> (case-insensitive). */
export function countHtmlHeadingTags(html: string, tag: "h2" | "h3"): number {
  const needle = `<${tag}`;
  const hay = html.toLowerCase();
  let count = 0;
  let from = 0;
  while (from < hay.length) {
    const at = hay.indexOf(needle, from);
    if (at === -1) break;
    const next = hay[at + needle.length];
    if (next === ">" || next === " " || next === "/") count += 1;
    from = at + needle.length;
  }
  return count;
}

export function extraTextHeadingContractOk(html: string): boolean {
  const trimmed = html.trim();
  if (!trimmed) return false;
  if (!trimmed.toLowerCase().startsWith("<h2")) return false;
  return countHtmlHeadingTags(trimmed, "h2") === 1 && countHtmlHeadingTags(trimmed, "h3") === 1;
}

/** Normalize model output to HTML for ACF (markdown ## legacy still supported). */
export function finalizeExtraTextHtml(raw: string): string {
  let text = raw.trim();
  const fence = text.match(/^```(?:html)?\s*\n?([\s\S]*?)\n?```$/i);
  if (fence) text = fence[1].trim();
  if (!text) return "";
  if (text.toLowerCase().startsWith("<h2")) return text;
  if (text.includes("## ") || text.startsWith("##")) return markdownToHtml(text);
  return markdownToHtml(text);
}

/** WordPress upload: HTML from generator, or convert legacy markdown. */
export function extraTextToUploadHtml(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.toLowerCase().startsWith("<h2")) return trimmed;
  return markdownToHtml(trimmed);
}

/** First inner text of `<h2>` or `<h3>` for harness row labels. */
export function extractFirstHeadingInnerText(html: string, tag: "h2" | "h3"): string {
  const open = `<${tag}`;
  const hay = html.toLowerCase();
  const start = hay.indexOf(open);
  if (start === -1) return "";
  const gt = html.indexOf(">", start);
  if (gt === -1) return "";
  const closeTag = `</${tag}>`;
  const end = hay.indexOf(closeTag, gt);
  if (end === -1) return "";
  let inner = html.slice(gt + 1, end).trim();
  let tagStart = inner.indexOf("<");
  while (tagStart !== -1) {
    const tagEnd = inner.indexOf(">", tagStart);
    if (tagEnd === -1) break;
    inner = (inner.slice(0, tagStart) + inner.slice(tagEnd + 1)).trim();
    tagStart = inner.indexOf("<");
  }
  return inner;
}

/** Join staged H2 fragment and H3+body fragment. */
export function stitchExtraTextFragments(h2SectionHtml: string, h3SectionHtml: string): string {
  const a = h2SectionHtml.trim();
  const b = h3SectionHtml.trim();
  if (!a) return finalizeExtraTextHtml(b);
  if (!b) return finalizeExtraTextHtml(a);
  return `${a}\n${b}`;
}

function normalizeHeadingCompare(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/** True when heading inner text contains the focus keyword phrase (case-insensitive). */
export function extraTextHeadingIncludesKeywordFocus(
  headingText: string,
  primaryKeyword: string,
): boolean {
  const h = normalizeHeadingCompare(headingText);
  const kw = normalizeHeadingCompare(primaryKeyword);
  if (!h || !kw) return false;
  return h.includes(kw);
}

export function extraTextHeadingsIncludeKeywordFocus(html: string, primaryKeyword: string): boolean {
  const h2 = extractFirstHeadingInnerText(html, "h2");
  const h3 = extractFirstHeadingInnerText(html, "h3");
  return (
    extraTextHeadingIncludesKeywordFocus(h2, primaryKeyword) &&
    extraTextHeadingIncludesKeywordFocus(h3, primaryKeyword)
  );
}

/** Inject focus keyword into first h2/h3 inner text when the model omitted it. */
export function enforceKeywordInExtraTextHeadings(html: string, primaryKeyword: string): string {
  const kw = primaryKeyword.trim();
  if (!kw || !html.trim()) return html;

  let out = html;
  for (const tag of ["h2", "h3"] as const) {
    const inner = extractFirstHeadingInnerText(out, tag);
    if (!extraTextHeadingIncludesKeywordFocus(inner, kw)) {
      const replacement = inner ? `${kw}: ${inner}` : kw;
      const open = `<${tag}`;
      const hay = out.toLowerCase();
      const start = hay.indexOf(open);
      if (start === -1) continue;
      const gt = out.indexOf(">", start);
      const closeTag = `</${tag}>`;
      const end = hay.indexOf(closeTag, gt);
      if (gt === -1 || end === -1) continue;
      out = `${out.slice(0, gt + 1)}${replacement}${out.slice(end)}`;
    }
  }
  return out;
}

/** @deprecated Prefer extraTextHeadingIncludesKeywordFocus; kept for legacy tests. */
export function extraTextHeadingDuplicatesKeywordOrTitle(
  headingText: string,
  primaryKeyword: string,
  subjectLine: string,
): boolean {
  const h = normalizeHeadingCompare(headingText);
  if (!h) return false;
  const kw = normalizeHeadingCompare(primaryKeyword);
  const title = normalizeHeadingCompare(subjectLine);
  if (kw && h === kw) return true;
  if (title && h === title) return true;
  if (kw && title && kw === title && h === kw) return true;
  return false;
}

export function extraTextHeadingsAvoidDuplicateKeywords(
  html: string,
  primaryKeyword: string,
  subjectLine: string,
): boolean {
  const h2 = extractFirstHeadingInnerText(html, "h2");
  const h3 = extractFirstHeadingInnerText(html, "h3");
  if (extraTextHeadingDuplicatesKeywordOrTitle(h2, primaryKeyword, subjectLine)) return false;
  if (extraTextHeadingDuplicatesKeywordOrTitle(h3, primaryKeyword, subjectLine)) return false;
  return true;
}

export const EXTRA_TEXT_HEADING_RETRY_USER = `REJECTED: Your last reply broke the heading contract.

Return ONLY HTML. No markdown, no preamble, no code fences.
- First character of the reply must be "<" starting <h2>
- Exactly one <h2>...</h2> and exactly one <h3>...</h3> in the whole block
- Order: <h2> → one or two <p> → <h3> → more <p>, optional <ul>/<table>, internal <a href> links
- Do not add a second <h2> or <h3>
- Both <h2> and <h3> must include the focus keyword phrase exactly (verbatim spelling and word order)`;
