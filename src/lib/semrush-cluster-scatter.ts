/**
 * Cluster Semrush keyword lists and assign clusters to document zones so the model
 * spreads phrasing across the article (mirrors GSC "spread" behavior).
 */

export type ScatterZone =
  | 'introduction'
  | 'body_early'
  | 'body_mid'
  | 'body_late'
  | 'faq'
  | 'conclusion';

export type SemrushCluster = {
  id: string;
  /** Short label for the cluster (shared tokens / theme) */
  theme: string;
  keywords: string[];
};

export type ScatterAssignment = {
  zone: ScatterZone;
  clusterIds: string[];
  /** What the writer should do in this zone with these clusters */
  instruction: string;
};

export type SemrushClusterScatterPlan = {
  clusters: SemrushCluster[];
  scatter: ScatterAssignment[];
};

const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'are', 'was', 'has', 'have', 'had', 'not', 'but', 'can', 'our', 'you', 'all', 'any', 'get', 'use',
]);

/** Strong tokens that alone can justify merging a pair (comparison / product vocabulary). */
const STRONG = new Set([
  'roman', 'cellular', 'roller', 'honeycomb', 'blinds', 'shades', 'curtains', 'drapes', 'window', 'bedroom', 'living', 'room', 'solar',
]);

function tokenize(kw: string): string[] {
  return kw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function shouldMerge(a: string, b: string): boolean {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return false;
  const shared = [...ta].filter((x) => tb.has(x));
  if (shared.length >= 2) return true;
  if (shared.length === 1 && STRONG.has(shared[0])) return true;
  return false;
}

class UnionFind {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    if (this.parent[i] !== i) this.parent[i] = this.find(this.parent[i]);
    return this.parent[i];
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

function themeForCluster(keywords: string[]): string {
  if (keywords.length === 0) return 'general';
  const freq = new Map<string, number>();
  for (const k of keywords) {
    for (const t of tokenize(k)) {
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
  }
  const top = [...freq.entries()]
    .filter(([w]) => STRONG.has(w) || w.length > 4)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([w]) => w);
  if (top.length === 0) {
    const words = tokenize(keywords[0]);
    return words.slice(0, 3).join(' ') || keywords[0].slice(0, 40);
  }
  return top.join(' · ');
}

const ZONE_ORDER: ScatterZone[] = [
  'introduction',
  'body_early',
  'body_mid',
  'body_late',
  'faq',
  'conclusion',
];

const ZONE_INSTRUCTION: Record<ScatterZone, string> = {
  introduction:
    'Use these phrasings in the opening context (first H2 block after any intro hook). Vary wording; one natural mention per phrase max.',
  body_early:
    'Weave into early substantive H2 sections (comparison, definitions, or “what to know”). Do not stack multiple phrases in one sentence.',
  body_mid:
    'Distribute through middle H2s (features, pros/cons, use cases). Prefer semantic variations.',
  body_late:
    'Use in later H2s (cost, installation, maintenance, or decision criteria) where relevant.',
  faq:
    'Where you have Q&A or comparison tables, incorporate only phrases that fit the question - no forced mentions.',
  conclusion:
    'Optional light reuse for closing summary; do not repeat phrasings already used heavily above.',
};

/**
 * Dedupe keywords (case-insensitive), preserve first-seen casing.
 */
function dedupeKeywords(lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const k of list) {
      const t = (k || '').trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

/**
 * Build clusters + zone assignments for every Semrush run (bulk artifact + prompt JSON).
 */
export function buildSemrushClusterScatterPlan(input: {
  acfKeyword: string;
  urlOrganicKeywords: string[];
  phraseRelatedKeywords: string[];
}): SemrushClusterScatterPlan {
  const all = dedupeKeywords([input.urlOrganicKeywords || [], input.phraseRelatedKeywords || []]);
  if (all.length === 0) {
    return { clusters: [], scatter: [] };
  }

  const n = all.length;
  const uf = new UnionFind(n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (shouldMerge(all[i], all[j])) uf.union(i, j);
    }
  }

  const buckets = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = uf.find(i);
    if (!buckets.has(r)) buckets.set(r, []);
    buckets.get(r)!.push(i);
  }

  const clusters: SemrushCluster[] = [...buckets.values()].map((indices, idx) => {
    const keywords = indices.map((i) => all[i]).sort((a, b) => a.length - b.length);
    return {
      id: `c${idx + 1}`,
      theme: themeForCluster(keywords),
      keywords,
    };
  });

  // Sort clusters: larger first (spread important groups first)
  clusters.sort((a, b) => b.keywords.length - a.keywords.length || b.theme.localeCompare(a.theme));
  clusters.forEach((c, i) => {
    c.id = `c${i + 1}`;
  });

  // Round-robin clusters across zones
  const scatter: ScatterAssignment[] = ZONE_ORDER.map((zone) => ({
    zone,
    clusterIds: [] as string[],
    instruction: ZONE_INSTRUCTION[zone],
  }));
  clusters.forEach((c, i) => {
    scatter[i % scatter.length].clusterIds.push(c.id);
  });

  return { clusters, scatter };
}

/**
 * JSON blob for the content model (same pattern as GSC context).
 */
export function buildSemrushScatterContextJson(plan: SemrushClusterScatterPlan | undefined): string | undefined {
  if (!plan || !plan.clusters?.length) return undefined;
  return JSON.stringify({
    semrush_keyword_clusters: {
      instruction:
        'Below are clusters of related search phrases and a scatter plan. Do NOT print this JSON. Work phrases in naturally across the article following the zone assignments. Do not stuff; do not repeat the same long phrase in multiple zones.',
      clusters: plan.clusters.map((c) => ({ id: c.id, theme: c.theme, keywords: c.keywords })),
      scatter: plan.scatter.map((s) => ({
        zone: s.zone,
        cluster_ids: s.clusterIds,
        hint: s.instruction,
      })),
    },
  });
}
