/**
 * Deterministic ACF Origin from SAP page titles: local SEO titles often end with
 * "… in Neighborhood, City" while `entity` may be broader (Wikipedia/metro).
 */

const NEEDLE = " in ";

/** Tails that are not geographic origins (avoid writing to ACF). */
function isInvalidOriginTail(tail: string): boolean {
  const t = tail.trim();
  if (t.length < 2) return true;
  if (/^\d{4}$/.test(t)) return true;
  if (/^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}$/i.test(t))
    return true;
  return false;
}

/**
 * Returns the location phrase after the last " in " in the title (SAP local pattern), or undefined.
 */
export function extractOriginFromSapTitle(title: string): string | undefined {
  const raw = typeof title === "string" ? title.trim() : "";
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (!lower.includes(NEEDLE)) return undefined;

  let lastStart = -1;
  let searchFrom = 0;
  while (true) {
    const i = lower.indexOf(NEEDLE, searchFrom);
    if (i < 0) break;
    lastStart = i;
    searchFrom = i + 1;
  }
  if (lastStart < 0) return undefined;

  const tail = raw
    .slice(lastStart + NEEDLE.length)
    .trim()
    .replace(/[.!?…]+$/u, "")
    .trim();
  if (!tail || isInvalidOriginTail(tail)) return undefined;
  return tail;
}

/** Set `origin` from the title when missing (for bulk ACF and exports). */
export function applySapOriginFromTitleToRows<T extends { title: string; origin?: string }>(rows: T[]): T[] {
  return rows.map((r) => {
    if (r.origin?.trim()) return r;
    const o = extractOriginFromSapTitle(r.title);
    return o ? ({ ...r, origin: o } as T) : r;
  });
}
