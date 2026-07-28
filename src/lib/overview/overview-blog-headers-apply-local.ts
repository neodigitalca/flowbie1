import type { BlogHeadersPlanResult } from "@/lib/overview/overview-blog-headers-agent";
import {
  countH2TagsInHtml,
  extractH2TextsFromHtml,
  htmlMissingLeadingH2,
  plainTextFromH2InnerHtml,
  sanitizeBlogHeaderPlainText,
  stripH2BlocksForCompare,
} from "@/lib/overview/overview-blog-headers-extract";
import { headerTextEqual } from "@/lib/overview/overview-blog-headers-plan-filter";

export type BlogHeadersReplaceResult = {
  was: string;
  now: string;
  ok: boolean;
};

function isTagBoundaryChar(ch: string | undefined): boolean {
  if (!ch || ch.length === 0) return true;
  const c = ch.charCodeAt(0);
  if (c <= 32) return true;
  return ch === "/" || ch === ">";
}

function findH2Ranges(html: string): Array<{ start: number; innerStart: number; innerEnd: number; end: number }> {
  const low = html.toLowerCase();
  const ranges: Array<{ start: number; innerStart: number; innerEnd: number; end: number }> = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) break;
    const h2OpenLen = "<h2".length;
    if (low.startsWith("<h2", lt) && isTagBoundaryChar(html[lt + h2OpenLen])) {
      const gt = html.indexOf(">", lt + h2OpenLen);
      if (gt === -1) break;
      const close = low.indexOf("</h2>", gt + 1);
      const innerStart = gt + 1;
      const innerEnd = close === -1 ? html.length : close;
      const end = close === -1 ? html.length : close + "</h2>".length;
      ranges.push({ start: lt, innerStart, innerEnd, end });
      i = end;
      continue;
    }
    i = lt + 1;
  }
  return ranges;
}

/** Replace the Nth H2 in blog HTML (0-based). No insert, no fallback. */
function replaceNthH2AtPlanIndex(
  html: string,
  planIndex: number,
  nowText: string,
  usedRangeIndexes: Set<number>,
): { html: string; ok: boolean; was: string } {
  const ranges = findH2Ranges(html);
  let ordinal = 0;
  for (let i = 0; i < ranges.length; i++) {
    if (usedRangeIndexes.has(i)) continue;
    if (ordinal !== planIndex) {
      ordinal += 1;
      continue;
    }
    const r = ranges[i]!;
    const was = plainTextFromH2InnerHtml(html.slice(r.innerStart, r.innerEnd));
    usedRangeIndexes.add(i);
    return {
      html: html.slice(0, r.innerStart) + nowText + html.slice(r.innerEnd),
      ok: true,
      was,
    };
  }
  return { html, ok: false, was: "" };
}

function insertH2BeforeFirstParagraph(html: string, text: string): string {
  const safe = sanitizeBlogHeaderPlainText(text);
  if (!safe) return html;
  const tag = `<h2>${safe}</h2>`;
  const pMatch = html.match(/<p[\s>]/i);
  if (pMatch?.index === undefined) return html;
  const hasH2Before = findH2Ranges(html).some((r) => r.start < pMatch.index!);
  if (hasH2Before) return html;
  return html.slice(0, pMatch.index) + tag + html.slice(pMatch.index);
}

export function applyBlogHeadersPlanLocally(
  html: string,
  plan: BlogHeadersPlanResult,
  existingH2s: string[],
  missingLeadingH2 = false,
): { updatedHtml: string; finalH2s: string[]; replacements: BlogHeadersReplaceResult[] } {
  let out = html;
  const replacements: BlogHeadersReplaceResult[] = [];
  const usedRangeIndexes = new Set<number>();
  const h2CountBefore = findH2Ranges(html).length;

  const actions = [...plan.h2Actions]
    .filter((a) => a.action === "optimize" && a.index >= 0 && a.index < existingH2s.length)
    .sort((a, b) => a.index - b.index);

  for (const action of actions) {
    const now = sanitizeBlogHeaderPlainText(action.proposedText);
    const wasCatalog = sanitizeBlogHeaderPlainText(existingH2s[action.index] ?? "");
    if (!now || !wasCatalog || headerTextEqual(wasCatalog, now)) {
      replacements.push({ was: wasCatalog, now, ok: false });
      continue;
    }
    const result = replaceNthH2AtPlanIndex(out, action.index, now, usedRangeIndexes);
    out = result.html;
    replacements.push({ was: result.was || wasCatalog, now, ok: result.ok });
  }

  const leading = missingLeadingH2 ? sanitizeBlogHeaderPlainText(plan.leadingH2 ?? "") : "";
  let leadingInserted = false;
  if (leading && htmlMissingLeadingH2(out)) {
    const beforeInsert = out;
    out = insertH2BeforeFirstParagraph(out, leading);
    if (out !== beforeInsert) {
      leadingInserted = true;
      replacements.unshift({ was: "", now: leading, ok: true });
    }
  }

  const h2CountAfter = countH2TagsInHtml(out);
  const maxAllowedH2 = h2CountBefore + (leadingInserted ? 1 : 0);

  if (h2CountAfter > maxAllowedH2) {
    return {
      updatedHtml: html,
      finalH2s: extractH2TextsFromHtml(html),
      replacements: [],
    };
  }

  const finalH2s = extractH2TextsFromHtml(out);

  return { updatedHtml: out, finalH2s, replacements };
}

export function verifyLocalHeadersApply(
  originalHtml: string,
  updatedHtml: string,
  opts?: { maxExtraH2?: number },
): { ok: true } | { ok: false; reason: string } {
  const before = countH2TagsInHtml(originalHtml);
  const after = countH2TagsInHtml(updatedHtml);
  const maxExtra = opts?.maxExtraH2 ?? 0;
  if (after > before + maxExtra) {
    return { ok: false, reason: `H2 count ${before} → ${after} (max +${maxExtra})` };
  }
  if (stripH2BlocksForCompare(originalHtml) !== stripH2BlocksForCompare(updatedHtml)) {
    return { ok: false, reason: "Non-H2 body markup changed" };
  }
  return { ok: true };
}
