/**
 * Granular pool markdown uses `### Article title` headings - same titles the Category/search APIs returned.
 */

export function extractArticleTitlesFromGranularPoolMarkdown(markdown: string): string[] {
  const out: string[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const m = /^###\s+(.+)$/.exec(line.trim());
    if (m) out.push(m[1].trim());
  }
  return out;
}

function stripPostalNoise(s: string): string {
  return s
    .replace(/\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/gi, "")
    .replace(/\bT\d[A-Z]\s?\d[A-Z]\d\b/gi, "")
    .replace(/\b\d{5}(-\d{4})?\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstSegment(s: string): string {
  const t = stripPostalNoise(s).split(",")[0] ?? "";
  return t.replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
}

export type GridPlaceWeaknessForWikiOrder = { place: string; weight: number };

/**
 * Prefer Wikipedia titles that name **sub-metro** places (neighbourhoods, districts, streets,
 * historic quarters) over bare **City, ST** metro umbrellas when both exist in the pool.
 * @internal Exported for tests.
 */
export function wikipediaTitleGranularityScore(title: string): number {
  const t = title.trim();
  if (!t) return 0;
  const commas = (t.match(/,/g) ?? []).length;
  let s = commas * 4;
  if (/\b(neighbourhood|neighborhood|district|quarter|ward|community|suburb)\b/i.test(t)) s += 12;
  if (/\b(historic district|business improvement|main street|downtown|midtown|uptown)\b/i.test(t)) s += 10;
  if (/\b(Ave|Avenue|St\.|Street|Road|Rd\.|Boulevard|Blvd\.|Drive|Dr\.|Lane|Way|Court|Ct\.|Route|Highway|Hwy)\b/i.test(t))
    s += 8;
  if (/\b(Park|Plaza|Square|Greenway|Trail|Landmark)\b/i.test(t)) s += 6;
  if (/\b(Industrial|corridor|pocket|area)\b/i.test(t)) s += 4;
  /** One comma + US state code only: whole-city / metro line (deprioritize vs finer `###` titles). */
  if (/^[^,]+,\s*[A-Z]{2}\s*$/.test(t)) s -= 8;
  return s;
}

/** Tokens shared with service-intent queries but not street/place names — do not boost wiki score via evidence. */
const EVIDENCE_SERVICE_STOP_TOKENS = new Set(
  [
    "chiropractic",
    "chiropractor",
    "treatment",
    "therapy",
    "therapeutic",
    "rehabilitation",
    "rehab",
    "wellness",
    "injury",
    "injuries",
    "pain",
    "medicine",
    "medical",
    "health",
    "prenatal",
    "pregnancy",
    "recovery",
    "accident",
    "workplace",
    "sciatica",
    "prevention",
    "preventive",
    "services",
  ].map((s) => s.toLowerCase()),
);

function evidenceOverlapBonus(title: string, evidence: string | null | undefined): number {
  const ev = evidence?.trim().toLowerCase();
  if (!ev) return 0;
  const tl = stripPostalNoise(title).toLowerCase();
  const tokens = ev.split(/\s+/).filter((w) => w.replace(/[^a-z0-9]/gi, "").length >= 4);
  const seen = new Set<string>();
  let b = 0;
  for (const w of tokens) {
    const k = w.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (k.length < 4 || seen.has(k)) continue;
    if (EVIDENCE_SERVICE_STOP_TOKENS.has(k)) continue;
    seen.add(k);
    if (tl.includes(k)) b += 2;
  }
  return Math.min(30, b);
}

/**
 * Reorder Wikipedia `###` titles so titles that match higher-weight grid place buckets
 * (City, ST, FSA, pin, etc.) are tried first in snap / modulo fallback (stable within same score).
 * Within the same grid-area score, **sub-metro** titles (neighbourhoods, streets, districts) sort
 * before bare **City, ST** umbrellas so snap and modulo fallback prefer hyperlocal anchors.
 * Optional **evidence** is row-derived text (Business + Address from weak ranks) for token overlap.
 */
export function orderWikipediaTitlesByGridPlaces(
  titles: string[],
  placeWeights: GridPlaceWeaknessForWikiOrder[],
  evidence?: string | null
): string[] {
  if (titles.length === 0) return [];
  if (placeWeights.length === 0) {
    const decorated = titles.map((t, i) => ({
      t,
      i,
      g: wikipediaTitleGranularityScore(t) + evidenceOverlapBonus(t, evidence),
    }));
    decorated.sort((a, b) => b.g - a.g || a.i - b.i);
    return decorated.map((x) => x.t);
  }
  const sortedPlaces = [...placeWeights].sort(
    (a, b) => b.weight - a.weight || a.place.localeCompare(b.place)
  );
  function scoreTitle(t: string): number {
    const tl = stripPostalNoise(t).toLowerCase();
    const fs = firstSegment(t);
    let best = 0;
    for (const pw of sortedPlaces) {
      const pl = pw.place.trim().toLowerCase();
      if (!pl) continue;
      const cityPart = pl.split(",")[0]?.trim().toLowerCase() ?? "";
      if (
        tl.includes(pl) ||
        pl.includes(fs) ||
        (cityPart.length > 0 && (fs.includes(cityPart) || tl.includes(cityPart)))
      ) {
        best = Math.max(best, pw.weight);
      } else {
        const fsaMk = /^fsa\s+([a-z]{3})$/i.exec(pl);
        if (fsaMk?.[1] && tl.includes(fsaMk[1])) best = Math.max(best, pw.weight);
      }
    }
    return best;
  }
  const decorated = titles.map((t, i) => ({
    t,
    i,
    s: scoreTitle(t) + evidenceOverlapBonus(t, evidence),
    g: wikipediaTitleGranularityScore(t),
  }));
  decorated.sort((a, b) => b.s - a.s || b.g - a.g || a.i - b.i);
  return decorated.map((x) => x.t);
}

/**
 * Map a model entityHint to a Wikipedia pool title: **exact** first-segment match only, else modulo.
 * Output is always an element of **titles** when non-empty (no loose substring match to wrong article).
 */
export function snapEntityHintToWikipediaArticleTitle(
  hint: string,
  titles: string[],
  rowIndex: number
): string {
  if (titles.length === 0) return hint.trim();
  const raw = hint.trim();
  const h = stripPostalNoise(raw).toLowerCase();
  if (!h) return titles[rowIndex % titles.length]!;

  for (const t of titles) {
    if (stripPostalNoise(t).toLowerCase() === h) return t;
  }
  const hFirst = firstSegment(raw);
  for (const t of titles) {
    const tFirst = firstSegment(t);
    if (hFirst && tFirst && hFirst === tFirst) {
      return t;
    }
  }
  return titles[rowIndex % titles.length]!;
}

export type RowWithOptionalEntity = { keyword: string; sapPages: number; entityHint?: string };

/**
 * Force every entityHint onto the Wikipedia pool list; keep pairwise distinct when possible.
 */
export function snapAllEntityHintsToWikipediaPoolTitles(
  rows: RowWithOptionalEntity[],
  titles: string[]
): RowWithOptionalEntity[] {
  if (titles.length === 0) return rows;
  const used = new Set<string>();
  return rows.map((r, i) => {
    let snapped = snapEntityHintToWikipediaArticleTitle(r.entityHint ?? "", titles, i);
    let key = snapped.trim().toLowerCase();
    if (used.has(key)) {
      const next = titles.find((t) => !used.has(t.trim().toLowerCase()));
      if (next) snapped = next;
      key = snapped.trim().toLowerCase();
    }
    used.add(key);
    return { ...r, entityHint: snapped };
  });
}
