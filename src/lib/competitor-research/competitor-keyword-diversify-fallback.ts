import type { CompetitorKeywordRow } from "@/lib/competitor-research/types";

export const MAX_CLUSTER_REPRESENTATIVES = 10;

function normalizePhrase(phrase: string): string {
  return phrase.trim().toLowerCase().replace(/\s+/g, " ");
}

function tokenSet(phrase: string): Set<string> {
  return new Set(
    phrase
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0),
  );
}

/** Jaccard similarity on word sets (0–1). */
export function keywordPhraseJaccard(a: string, b: string): number {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const x of A) {
    if (B.has(x)) inter += 1;
  }
  if (inter === 0) return 0;
  return inter / (A.size + B.size - inter);
}

function passesExcludeGate(
  phrase: string,
  excludePhrases: string[],
  overlapThreshold: number,
): boolean {
  if (excludePhrases.length === 0) return true;
  return excludePhrases.every((ex) => {
    const t = ex.trim();
    if (!t) return true;
    return keywordPhraseJaccard(phrase, t) < overlapThreshold;
  });
}

/**
 * Greedy diversity: traffic-first order, then add a row only if it is not too similar to any already picked.
 * Optional `excludePhrases` (e.g. GSC + seed coverage) - deprioritizes rows similar to those intents.
 * Does not invent phrases; only reorders/filters the input list.
 */
export function diversifyKeywordsGreedy(
  rows: CompetitorKeywordRow[],
  maxPick: number,
  overlapThreshold = 0.55,
  excludePhrases: string[] = [],
): CompetitorKeywordRow[] {
  const lim = Math.min(Math.max(1, maxPick), MAX_CLUSTER_REPRESENTATIVES);
  const excludes = excludePhrases.map((p) => p.trim()).filter(Boolean);
  const sorted = [...rows].sort((a, b) => {
    const ta = a.traffic ?? Number.NEGATIVE_INFINITY;
    const tb = b.traffic ?? Number.NEGATIVE_INFINITY;
    const ha = Number.isFinite(ta);
    const hb = Number.isFinite(tb);
    if (ha && hb && tb !== ta) return tb - ta;
    if (ha && !hb) return -1;
    if (!ha && hb) return 1;
    const va = a.volume ?? Number.NEGATIVE_INFINITY;
    const vb = b.volume ?? Number.NEGATIVE_INFINITY;
    if (vb !== va) return vb - va;
    return (a.phrase || "").localeCompare(b.phrase || "");
  });

  const picked: CompetitorKeywordRow[] = [];
  const seenPhrase = new Set<string>();

  for (const row of sorted) {
    const np = normalizePhrase(row.phrase);
    if (!np || seenPhrase.has(np)) continue;
    if (!passesExcludeGate(row.phrase, excludes, overlapThreshold)) continue;

    if (picked.length === 0) {
      picked.push(row);
      seenPhrase.add(np);
      if (picked.length >= lim) break;
      continue;
    }

    const ok = picked.every((q) => keywordPhraseJaccard(q.phrase, row.phrase) < overlapThreshold);
    if (ok) {
      picked.push(row);
      seenPhrase.add(np);
    }
    if (picked.length >= lim) break;
  }

  if (picked.length === 0 && rows.length > 0) {
    return diversifyKeywordsGreedy(rows, maxPick, overlapThreshold, []);
  }

  return picked;
}
