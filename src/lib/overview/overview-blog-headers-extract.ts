import {
  OVERVIEW_AUDIT_FULL_POST_LABEL,
  OVERVIEW_AUDIT_PREAMBLE_LABEL,
  splitHtmlForOverviewAudit,
} from "@/lib/overview/overview-post-html-audit-sections";

function isTagBoundaryChar(ch: string | undefined): boolean {
  if (!ch || ch.length === 0) return true;
  const c = ch.charCodeAt(0);
  if (c <= 32) return true;
  return ch === "/" || ch === ">";
}

function findH2OpenPositions(html: string): number[] {
  const low = html.toLowerCase();
  const out: number[] = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) break;
    const h2OpenLen = "<h2".length;
    if (low.startsWith("<h2", lt) && isTagBoundaryChar(html[lt + h2OpenLen])) {
      out.push(lt);
      i = lt + 1;
      continue;
    }
    i = lt + 1;
  }
  return out;
}

/** True when paragraphs appear before the first H2 in the body. */
export function htmlMissingLeadingH2(html: string): boolean {
  const trimmed = (html ?? "").trim();
  if (!trimmed) return false;
  const h2Starts = findH2OpenPositions(trimmed);
  const firstH2 = h2Starts[0] ?? trimmed.length;
  if (firstH2 === 0) return false;
  return /<p[\s>]/i.test(trimmed.slice(0, firstH2));
}

/** Ordered H2 inner texts from post HTML (inventory / grid body). */
export function extractH2TextsFromHtml(html: string): string[] {
  const trimmed = (html ?? "").trim();
  if (!trimmed) return [];
  const sections = splitHtmlForOverviewAudit(trimmed);
  const out: string[] = [];
  for (const sec of sections) {
    if (sec.sectionLabel === OVERVIEW_AUDIT_PREAMBLE_LABEL) continue;
    if (sec.sectionLabel === OVERVIEW_AUDIT_FULL_POST_LABEL) continue;
    const label = sec.sectionLabel.trim();
    if (label) out.push(label);
  }
  return out;
}

/** Count opening <h2> tags in document order. */
export function countH2TagsInHtml(html: string): number {
  return findH2OpenPositions(html ?? "").length;
}

/** Plain heading text safe for H2 inner HTML (no tags). */
export function sanitizeBlogHeaderPlainText(text: string): string {
  return plainTextFromH2InnerHtml(text ?? "").trim();
}

/** Plain inner text of an H2 element slice (matches extractH2TextsFromHtml labels). */
export function plainTextFromH2InnerHtml(innerHtml: string): string {
  let out = "";
  let cursor = 0;
  while (cursor < innerHtml.length) {
    const lt = innerHtml.indexOf("<", cursor);
    if (lt === -1) {
      out += innerHtml.slice(cursor);
      break;
    }
    out += innerHtml.slice(cursor, lt);
    const gt = innerHtml.indexOf(">", lt + 1);
    if (gt === -1) break;
    cursor = gt + 1;
  }
  const decoded = out
    .split("&nbsp;")
    .join("\u00a0")
    .split("&amp;")
    .join("&")
    .split("&lt;")
    .join("<")
    .split("&gt;")
    .join(">")
    .split("&quot;")
    .join('"');
  return decoded.replace(/\s+/g, " ").trim();
}

/** Remove entire h2 blocks (tags + inner text) for body-only structural compare. */
export function stripH2BlocksForCompare(html: string): string {
  const src = html ?? "";
  const low = src.toLowerCase();
  let out = "";
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt === -1) {
      out += src.slice(i);
      break;
    }
    out += src.slice(i, lt);
    const h2OpenLen = "<h2".length;
    if (low.startsWith("<h2", lt) && isTagBoundaryChar(src[lt + h2OpenLen])) {
      const close = low.indexOf("</h2>", lt + h2OpenLen);
      i = close === -1 ? src.length : close + "</h2>".length;
      continue;
    }
    const gt = src.indexOf(">", lt + 1);
    if (gt === -1) {
      out += src.slice(lt);
      break;
    }
    out += src.slice(lt, gt + 1);
    i = gt + 1;
  }
  return out;
}

/** Remove all h2 open/close tags for structural body compare (inner text preserved). */
export function stripH2TagsForCompare(html: string): string {
  const src = html ?? "";
  const low = src.toLowerCase();
  let out = "";
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt === -1) {
      out += src.slice(i);
      break;
    }
    out += src.slice(i, lt);
    const h2OpenLen = "<h2".length;
    if (low.startsWith("<h2", lt) && isTagBoundaryChar(src[lt + h2OpenLen])) {
      const gt = src.indexOf(">", lt + h2OpenLen);
      i = gt === -1 ? src.length : gt + 1;
      continue;
    }
    const h2Close = "</h2>";
    if (low.startsWith(h2Close, lt)) {
      i = lt + h2Close.length;
      continue;
    }
    const gt = src.indexOf(">", lt + 1);
    if (gt === -1) {
      out += src.slice(lt);
      break;
    }
    out += src.slice(lt, gt + 1);
    i = gt + 1;
  }
  return out;
}
