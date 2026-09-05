/** Fixed short H2 for every [ILLUSTRATIVE] body section (SAP + blog). */
export const ILLUSTRATIVE_DEFAULT_H2 = "A Local Homeowner Example";

export function isBadIllustrativeH2Title(title: string): boolean {
  const t = title.trim().toLowerCase();
  if (!t) return true;
  if (t === ILLUSTRATIVE_DEFAULT_H2.toLowerCase()) return false;
  if (/realistic local|local situation|local scenario/.test(t)) return true;
  if (/^scenario\s*:/.test(t)) return true;
  if (t.includes("?")) return true;
  if (/\bnear\b/.test(t)) return true;
  if (/<a\b/i.test(title)) return true;
  return t.split(/\s+/).length > 8;
}

export function resolveIllustrativeH2Title(title?: string): string {
  const t = title?.trim() ?? "";
  if (t && !isBadIllustrativeH2Title(t)) return t;
  return ILLUSTRATIVE_DEFAULT_H2;
}

/** Replace the H2 title prefix on a numbered checklist row; keep feature markers. */
export function replaceChecklistItemHeading(item: string, newTitle: string): string {
  const num = item.match(/^(\d+\.\s*)/)?.[1] ?? "";
  const markerStart = item.search(
    /\[(?:STRUCTURE|ILLUSTRATIVE|BLOCKQUOTE|LINK|TABLE|LIST|DECISION|TRADEOFF|RECOMMENDATION|NUMBERS|REAL-WORLD)/i,
  );
  const suffix = markerStart >= 0 ? item.slice(markerStart) : "";
  return `${num}${newTitle} ${suffix}`.replace(/\s{2,}/g, " ").trim();
}

/** Strip [ILLUSTRATIVE] / [BLOCKQUOTE] markers from non-illustrative SAP checklist rows. */
export function stripIllustrativeMarkersFromChecklistItem(item: string): string {
  return item
    .replace(/\s*\[ILLUSTRATIVE\][^\[]*(?=\[|$)/gi, "")
    .replace(/\s*\[BLOCKQUOTE\][^\[]*(?=\[|$)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Checklist line: force illustrative item to the fixed short H2 title. */
export function rewriteIllustrativeChecklistItemHeading(
  item: string,
  index?: number,
  sapEntity?: string,
): string {
  if (/\[FAQ\]/i.test(item)) return item;
  const sap = sapEntity?.trim();
  if (sap) {
    if (index === 3) {
      return replaceChecklistItemHeading(item, ILLUSTRATIVE_DEFAULT_H2);
    }
    return stripIllustrativeMarkersFromChecklistItem(item);
  }
  if (!/\[illustrative\]/i.test(item)) return item;
  return replaceChecklistItemHeading(item, ILLUSTRATIVE_DEFAULT_H2);
}
