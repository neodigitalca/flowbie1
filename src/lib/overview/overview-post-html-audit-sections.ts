/**
 * Split WordPress content.rendered for sectional audits: preamble + segments at each opening <h2>.
 * Uses string scanning on the original HTML so slice boundaries stay verbatim-identical substrings.
 */

export const OVERVIEW_AUDIT_PREAMBLE_LABEL = "Before first heading";
export const OVERVIEW_AUDIT_FULL_POST_LABEL = "Full post";

export type OverviewHtmlAuditSection = {
  sectionIndex: number;
  sectionLabel: string;
  /** Verbatim contiguous slice of the original post HTML */
  html: string;
};

function isTagBoundaryChar(ch: string | undefined): boolean {
  if (!ch || ch.length === 0) return true;
  const c = ch.charCodeAt(0);
  if (c <= 32) return true;
  return ch === "/" || ch === ">";
}

function findAllH2SplitPoints(html: string): number[] {
  const low = html.toLowerCase();
  const out: number[] = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) break;

    if (low.startsWith("<!--", lt)) {
      const end = low.indexOf("-->", lt + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }

    const scriptOpenLen = "<script".length;
    if (low.startsWith("<script", lt) && isTagBoundaryChar(html[lt + scriptOpenLen])) {
      const end = low.indexOf("</script>", lt);
      i = end === -1 ? html.length : end + "</script>".length;
      continue;
    }

    const styleOpenLen = "<style".length;
    if (low.startsWith("<style", lt) && isTagBoundaryChar(html[lt + styleOpenLen])) {
      const end = low.indexOf("</style>", lt);
      i = end === -1 ? html.length : end + "</style>".length;
      continue;
    }

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

function stripAngleBracketsInnerText(fragment: string): string {
  let out = "";
  let cursor = 0;
  while (cursor < fragment.length) {
    const lt = fragment.indexOf("<", cursor);
    if (lt === -1) {
      out += fragment.slice(cursor);
      break;
    }
    out += fragment.slice(cursor, lt);
    const gt = fragment.indexOf(">", lt + 1);
    if (gt === -1) break;
    cursor = gt + 1;
  }
  return out;
}

function collapseAsciiRuns(s: string): string {
  const parts: string[] = [];
  let buf = "";
  let lastWs = false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const ws = c <= 32;
    if (ws) {
      if (!lastWs && buf.length > 0) {
        parts.push(buf);
        buf = "";
      }
      lastWs = true;
      continue;
    }
    buf += String.fromCharCode(c);
    lastWs = false;
  }
  if (buf.length > 0) parts.push(buf);
  return parts.join(" ");
}

function simpleDecodeBasicEntities(raw: string): string {
  return raw
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
}

/** Derives a readable label from the first <h2>…</h2> in this slice (opening should be near the left edge). */
function labelFromLeadingH2(sectionHtml: string): string | null {
  const low = sectionHtml.toLowerCase();
  const open = low.indexOf("<h2");
  if (open === -1) return null;
  if (!isTagBoundaryChar(sectionHtml[open + "<h2".length])) return null;

  const gtRel = sectionHtml.indexOf(">", open + "<h2".length);
  if (gtRel === -1) return null;
  const close = low.indexOf("</h2>", gtRel + 1);
  const innerRaw = close === -1 ? sectionHtml.slice(gtRel + 1) : sectionHtml.slice(gtRel + 1, close);
  const text = collapseAsciiRuns(simpleDecodeBasicEntities(stripAngleBracketsInnerText(innerRaw)).trim());
  const clipped = text.length > 160 ? `${text.slice(0, 160)}…` : text;
  return clipped.length > 0 ? clipped : null;
}

/**
 * Split post HTML into ordered sections:
 * - Preamble slice before first <h2> when present (non-empty trim).
 * - One slice per heading block from each <h2> through markup before the next <h2>.
 * - Without any <h2>, returns a single "Full post" section.
 */
export function splitHtmlForOverviewAudit(html: string): OverviewHtmlAuditSection[] {
  const trimmedOuter = html;
  const splits = findAllH2SplitPoints(trimmedOuter);
  if (splits.length === 0) {
    return [{ sectionIndex: 0, sectionLabel: OVERVIEW_AUDIT_FULL_POST_LABEL, html: trimmedOuter }];
  }

  const out: OverviewHtmlAuditSection[] = [];

  const firstStart = splits[0]!;
  if (firstStart > 0) {
    const preamble = trimmedOuter.slice(0, firstStart);
    if (preamble.trim().length > 0) {
      out.push({
        sectionIndex: out.length,
        sectionLabel: OVERVIEW_AUDIT_PREAMBLE_LABEL,
        html: preamble,
      });
    }
  }

  for (let i = 0; i < splits.length; i++) {
    const start = splits[i]!;
    const end = i + 1 < splits.length ? splits[i + 1]! : trimmedOuter.length;
    const sliceHtml = trimmedOuter.slice(start, end);
    const derived = labelFromLeadingH2(sliceHtml);
    out.push({
      sectionIndex: out.length,
      sectionLabel: derived ?? `Section ${out.length + 1}`,
      html: sliceHtml,
    });
  }

  return out.map((sec, ri) => ({ ...sec, sectionIndex: ri }));
}

/**
 * Concatenate ordered audit slices back to a single HTML string.
 * For any `splitHtmlForOverviewAudit(html)` result, this equals the original `html`.
 */
export function concatenateOverviewAuditSectionHtml(sections: OverviewHtmlAuditSection[]): string {
  return sections.map((s) => s.html).join("");
}
