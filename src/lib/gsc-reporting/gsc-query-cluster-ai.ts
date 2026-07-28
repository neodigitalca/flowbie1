/**
 * OpenRouter: group GSC query rows into thematic clusters (index-based JSON).
 * Totals are computed locally for verification; markdown is injected into report pipeline.
 */
import type { GscParsedQueryRow } from "@/lib/gsc-export-csv-parse";
import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { extractJsonObjectFromModelText } from "@/lib/gsc-manual-ai-aggregate";

/** Max query rows sent to the model (sorted by impressions). Remaining rows get one extra cluster. */
export const GSC_QUERY_CLUSTER_MAX_ROWS_FOR_AI = 1200;
export const GSC_QUERY_CLUSTER_MAX_GROUPS = 8;

/** Max query strings listed per cluster in pipeline markdown (sorted by impressions, highest first). */
export const GSC_QUERY_CLUSTER_MAX_QUERIES_IN_MARKDOWN = 25;

/** Lower temperature for deterministic JSON cluster output. */
const GSC_QUERY_CLUSTER_TEMPERATURE = 0.15;

/** First top-level `{ ... }` in text, respecting strings and escapes (handles extra prose / fences). */
function extractBalancedJsonObject(text: string): string | null {
  const i = text.indexOf("{");
  if (i < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let p = i; p < text.length; p++) {
    const ch = text[p]!;
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === "\\") {
        esc = true;
        continue;
      }
      if (ch === '"') {
        inStr = false;
        continue;
      }
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(i, p + 1);
    }
  }
  return null;
}

/** Remove trailing commas before `}` or `]` outside of JSON strings (common model mistake). */
function stripTrailingCommasFromJsonish(s: string): string {
  const out: string[] = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (inStr) {
      out.push(ch);
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      out.push(ch);
      continue;
    }
    if (ch === ",") {
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j]!)) j++;
      if (j < s.length && (s[j] === "}" || s[j] === "]")) {
        continue;
      }
    }
    out.push(ch);
  }
  return out.join("");
}

/**
 * Parse cluster JSON from model output: markdown fences, prose, trailing commas, first balanced object.
 * Returns null if nothing could be parsed as a JSON object.
 */
export function parseClusterJsonFromModelContent(raw: string): unknown | null {
  const candidates = new Set<string>();
  const fenced = extractJsonObjectFromModelText(raw);
  candidates.add(fenced);
  const balRaw = extractBalancedJsonObject(raw.trim());
  if (balRaw) candidates.add(balRaw);
  const balFenced = extractBalancedJsonObject(fenced);
  if (balFenced) candidates.add(balFenced);

  for (const c of candidates) {
    const attempts = [c, stripTrailingCommasFromJsonish(c)];
    for (const s of attempts) {
      try {
        const out = JSON.parse(s) as unknown;
        if (out !== null && typeof out === "object") return out;
      } catch {
        /* next */
      }
    }
  }
  return null;
}

export type GscQueryClusterTotals = {
  clicks: number;
  impressions: number;
  /** 0–1 */
  ctr: number;
  /** Impression-weighted average position */
  positionWeighted: number;
};

export type GscQueryClusterGroup = {
  name: string;
  rows: GscParsedQueryRow[];
  totals: GscQueryClusterTotals;
};

export type QueryClusterUiState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; groups: GscQueryClusterGroup[] };

export function computeGscQueryClusterTotals(rows: GscParsedQueryRow[]): GscQueryClusterTotals {
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const positionWeighted =
    impressions > 0 ? rows.reduce((s, r) => s + r.position * r.impressions, 0) / impressions : 0;
  return { clicks, impressions, ctr, positionWeighted };
}

function formatCtrPct(ctr: number): string {
  const c = ctr <= 1 ? ctr * 100 : ctr;
  return `${c.toFixed(2)}%`;
}

/** Raw markdown for `Queries-AI-clusters.md` - not part of the outline; pipeline attaches this file separately. */
export function buildQueryClustersMarkdownForPipeline(groups: GscQueryClusterGroup[]): string {
  if (groups.length === 0) return "";
  const lines: string[] = [
    `# AI query clusters (for report generation)`,
    ``,
    `Cluster **totals** below are **sums / weighted averages from the Queries CSV** (not model-invented). Use cluster names and these figures when writing cluster sections.`,
    ``,
  ];
  for (const g of groups) {
    const t = g.totals;
    const sorted = [...g.rows].sort((a, b) => b.impressions - a.impressions);
    const top = sorted.slice(0, GSC_QUERY_CLUSTER_MAX_QUERIES_IN_MARKDOWN);
    const queryList = top.map((r) => r.query).join(", ");
    const suffix =
      g.rows.length > GSC_QUERY_CLUSTER_MAX_QUERIES_IN_MARKDOWN
        ? ` (plus ${g.rows.length - GSC_QUERY_CLUSTER_MAX_QUERIES_IN_MARKDOWN} more queries in this cluster - summarize themes, do not list all)`
        : "";
    lines.push(`## ${g.name}`);
    lines.push(`- **Total clicks:** ${t.clicks}`);
    lines.push(`- **Total impressions:** ${t.impressions}`);
    lines.push(`- **CTR (Σclicks ÷ Σimpressions):** ${formatCtrPct(t.ctr)}`);
    lines.push(`- **Avg position (impression-weighted):** ${t.positionWeighted.toFixed(2)}`);
    lines.push(`- **Top queries in cluster (by impressions, max ${GSC_QUERY_CLUSTER_MAX_QUERIES_IN_MARKDOWN}):** ${queryList}${suffix}`);
    lines.push(``);
  }
  return lines.join("\n");
}

function normalizeClustersFromAi(
  rawClusters: { name: string; indices: number[] }[],
  n: number,
): { name: string; indices: number[] }[] {
  const used = new Set<number>();
  const out: { name: string; indices: number[] }[] = [];
  for (const c of rawClusters) {
    const name = String(c.name ?? "").trim() || "Cluster";
    const idx: number[] = [];
    for (const i of c.indices) {
      const j = Math.floor(Number(i));
      if (Number.isFinite(j) && j >= 0 && j < n && !used.has(j)) {
        used.add(j);
        idx.push(j);
      }
    }
    if (idx.length) out.push({ name, indices: idx });
  }
  const missing: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!used.has(i)) missing.push(i);
  }
  if (missing.length) {
    out.push({ name: "Other", indices: missing });
  }
  return out;
}

function parseClustersJson(json: unknown, n: number): { name: string; indices: number[] }[] {
  const raw = json as { clusters?: unknown };
  if (!raw || !Array.isArray(raw.clusters) || raw.clusters.length === 0) {
    return [];
  }
  const parsed: { name: string; indices: number[] }[] = [];
  for (const c of raw.clusters) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const name = String(o.name ?? "").trim();
    const indicesRaw = o.indices;
    if (!name || !Array.isArray(indicesRaw)) continue;
    const indices = indicesRaw.map((x) => Math.floor(Number(x))).filter((x) => Number.isFinite(x));
    if (indices.length) parsed.push({ name, indices });
  }
  return normalizeClustersFromAi(parsed, n);
}

export async function clusterGscQueriesWithOpenRouter(args: {
  apiKey: string;
  model: string;
  allRows: GscParsedQueryRow[];
  signal?: AbortSignal;
}): Promise<GscQueryClusterGroup[]> {
  const { allRows, apiKey, model, signal } = args;
  if (allRows.length === 0) return [];

  const sorted = [...allRows].sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks);
  const head = sorted.slice(0, GSC_QUERY_CLUSTER_MAX_ROWS_FOR_AI);
  const tail = sorted.slice(GSC_QUERY_CLUSTER_MAX_ROWS_FOR_AI);
  const n = head.length;

  const system = `You group Google Search Console queries into thematic clusters.

You MUST output exactly one JSON object and nothing else - no markdown fences, no commentary.

Schema:
{
  "clusters": [
    { "name": "Short label (3–7 words)", "indices": [0, 2, 5] }
  ]
}

Rules:
- "indices" are **0-based** positions in the user list (first row = 0, last = ${n - 1}).
- **Every** index from 0 to ${n - 1} must appear **exactly once** across all clusters (partition).
- At most ${GSC_QUERY_CLUSTER_MAX_GROUPS} clusters.
- Group by **semantic similarity** (brand, product, topic, intent). Similar spellings / same entity belong together.
- Cluster names must be concise and readable.`;

  const compact = head
    .map((row, i) => `${i}\t${row.query}\t${row.clicks}\t${row.impressions}\t${row.position}`)
    .join("\n");

  const user = `Here are ${n} GSC queries (tab-separated: index, query, clicks, impressions, position).

${compact}`;

  const maxTokens = Math.min(8000, getCompetitorReportMaxOutputTokens(model));
  const { content } = await callOpenRouterChatCompletion({
    apiKey,
    model,
    system,
    user,
    maxTokens,
    signal,
    temperature: GSC_QUERY_CLUSTER_TEMPERATURE,
  });

  let parsedJson = parseClusterJsonFromModelContent(content);
  if (parsedJson === null) {
    parsedJson = { clusters: [{ name: "All queries", indices: [...Array(n).keys()] }] };
  }

  let normalized = parseClustersJson(parsedJson, n);
  if (normalized.length === 0) {
    normalized = [{ name: "All queries", indices: [...Array(n).keys()] }];
  }

  const groups: GscQueryClusterGroup[] = [];
  for (const c of normalized) {
    const rows = c.indices.map((i) => head[i]!).filter(Boolean);
    if (rows.length) {
      groups.push({
        name: c.name,
        rows,
        totals: computeGscQueryClusterTotals(rows),
      });
    }
  }

  if (tail.length > 0) {
    groups.push({
      name: `Remaining queries (outside top ${GSC_QUERY_CLUSTER_MAX_ROWS_FOR_AI} by impressions)`,
      rows: tail,
      totals: computeGscQueryClusterTotals(tail),
    });
  }

  return groups;
}

export function pickClusterMarkdownForPipeline(
  files: { name: string }[],
  byFile: Record<number, QueryClusterUiState>,
): string | null {
  for (let i = 0; i < files.length; i++) {
    const nm = files[i]!.name.toLowerCase();
    if (!nm.includes("queries")) continue;
    const s = byFile[i];
    if (s?.status === "ready" && s.groups.length > 0) {
      return buildQueryClustersMarkdownForPipeline(s.groups);
    }
  }
  const keys = Object.keys(byFile)
    .map(Number)
    .sort((a, b) => a - b);
  for (const i of keys) {
    const s = byFile[i];
    if (s?.status === "ready" && s.groups.length > 0) {
      return buildQueryClustersMarkdownForPipeline(s.groups);
    }
  }
  return null;
}
