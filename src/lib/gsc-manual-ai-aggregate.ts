/**
 * Manual GSC CSV upload → single OpenRouter call → validated slim markdown for KB.
 * No raw CSV storage; no per-row keyword API enrichment.
 */
import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";

/** Total UTF-16 length of bundled file text sent to the model (hard cap). */
export const GSC_MANUAL_MAX_INPUT_CHARS = 350_000;

/** Hard caps on model output (validated after parse). */
export const GSC_MANUAL_MAX_SUMMARY_CHARS = 4_000;
export const GSC_MANUAL_MAX_TOP_ROWS = 12;
export const GSC_MANUAL_MAX_CLUSTERS = 8;
export const GSC_MANUAL_MAX_EXAMPLES_PER_CLUSTER = 12;
export const GSC_MANUAL_MAX_EVIDENCE_LINES = 8;
export const GSC_MANUAL_MAX_EVIDENCE_LINE_CHARS = 450;
export const GSC_MANUAL_MAX_OUTPUT_CHARS = 120_000;

export type GscManualAiTopRow = {
  rank: number;
  label: string;
  why: string;
  /** Must quote exact numbers from the CSV (clicks, impressions, CTR, position, both periods if present). */
  metrics: string;
  /** Verbatim supporting lines from the sheet(s): query/page + numeric columns as in the file. */
  evidence?: string[];
};

export type GscManualAiCluster = {
  name: string;
  examples: string[];
  aggregate: string;
};

export type GscManualAiPayload = {
  executiveSummary: string;
  topOpportunities: GscManualAiTopRow[];
  clusters: GscManualAiCluster[];
};

const SYSTEM_PROMPT = `You are an SEO analyst. The user uploads one or more Google Search Console CSV exports (queries, pages, comparison periods, search appearance, countries, devices, etc.).

You MUST output exactly one JSON object and nothing else - no markdown fences, no commentary before or after.

Schema (all limits are strict):
{
  "executiveSummary": string,
  "topOpportunities": [
    {
      "rank": number,
      "label": string,
      "why": string,
      "metrics": string,
      "evidence": string[]
    }
  ],
  "clusters": [
    { "name": string, "examples": string[], "aggregate": string }
  ]
}

Rules - preserve concrete data (this is critical):
- **Numbers must come from the CSV text.** For every period column (e.g. March vs February), quote the actual values shown (clicks, impressions, CTR, position). Do **not** round to vague phrases like "thousands of impressions" or "position 70+" when the file has exact integers or decimals - use the file values.
- **metrics** (required): one dense line of **verbatim** key figures for that opportunity (period columns as labeled in the header). If you combine rows, still give representative exact figures for the most important row(s).
- **evidence** (required for each top opportunity): ${GSC_MANUAL_MAX_EVIDENCE_LINES} or fewer strings. Each string is one **verbatim or minimally shortened** line: the query/page identifier plus the numeric columns **exactly as in the CSV** (copy numbers; do not invent). Prefer real rows from Queries.csv / Pages.csv over paraphrase.
- executiveSummary: at most ${GSC_MANUAL_MAX_SUMMARY_CHARS} characters. Cite specific totals or deltas **using numbers from the files** where possible (branded clicks, homepage impressions, etc.). **Do not** output prioritized action lists, "next steps", or "priority" framing; keep factual synthesis only.
- topOpportunities: at most ${GSC_MANUAL_MAX_TOP_ROWS} rows. Rank by business impact (growth, high impressions + low clicks/CTR, position opportunity, URL priority).
- clusters: at most ${GSC_MANUAL_MAX_CLUSTERS} clusters. Each cluster: at most ${GSC_MANUAL_MAX_EXAMPLES_PER_CLUSTER} example queries or full page URLs in "examples". **aggregate** may summarize but should reference real magnitudes from the data when stating scale.
- You still **must not** paste the entire sheet - but you **must not** strip away precision: synthesis + exact figures, not vague ranges.
- **Cross-metric period compare:** When site totals show **Search queries** up AND **Total impressions** up AND **average position** worsened (higher number), interpret as **query footprint expansion** (new/long-tail terms diluting the site-wide average), **not** overall search visibility decline. When **Site-totals-compare-signals.txt** is present, obey \`primaryPattern\` and \`interpretation\`.

Respond with valid JSON only.`;

function fileBlock(name: string, body: string): string {
  return `--- FILE: ${name} ---\n${body}`;
}

/**
 * Bundle CSV text for the user message. If over cap, **each file** keeps a proportional
 * slice (with a minimum per file) so Pages / Search appearance are not dropped when Queries is huge.
 */
export function bundleGscManualFilesForPrompt(
  files: { name: string; content: string }[],
): { text: string; truncated: boolean; filenames: string[] } {
  const filenames = files.map((f) => f.name);
  const fullParts = files.map((f) => fileBlock(f.name, f.content));
  let text = fullParts.join("\n\n");
  if (text.length <= GSC_MANUAL_MAX_INPUT_CHARS) {
    return { text, truncated: false, filenames };
  }

  let minPerFile = 800;
  const rawTotal = files.reduce((s, f) => s + f.content.length, 0);
  const overhead = files.reduce((s, f) => s + fileBlock(f.name, "").length, 0);
  const budget = Math.max(0, GSC_MANUAL_MAX_INPUT_CHARS - overhead - 200);
  const n = files.length;
  let minSum = minPerFile * n;
  let distributable = budget - minSum;
  if (distributable < 0) {
    minPerFile = Math.max(200, Math.floor(budget / Math.max(1, n)));
    minSum = minPerFile * n;
    distributable = Math.max(0, budget - minSum);
  }

  const parts: string[] = [];
  for (const f of files) {
    const share =
      rawTotal > 0
        ? minPerFile + Math.floor((distributable * f.content.length) / rawTotal)
        : minPerFile;
    const cap = Math.min(f.content.length, share);
    const slice = f.content.slice(0, cap);
    const tailNote =
      f.content.length > cap
        ? `\n[…truncated ${f.name}: showing ${cap} of ${f.content.length} characters; prioritize visible rows…]`
        : "";
    parts.push(fileBlock(f.name, slice + tailNote));
  }
  text = parts.join("\n\n");
  if (text.length > GSC_MANUAL_MAX_INPUT_CHARS) {
    text = text.slice(0, GSC_MANUAL_MAX_INPUT_CHARS) + "\n\n[HARD TRUNCATION: input still exceeded cap after per-file split.]";
  }
  return { text, truncated: true, filenames };
}

/** Strip optional ``` / ```json fences; else first `{` … last `}`. */
export function extractJsonObjectFromModelText(raw: string): string {
  const t = raw.trim();
  const open = t.indexOf("```");
  if (open >= 0) {
    let after = t.slice(open + 3);
    after = after.replace(/^\s*json\s*/i, "");
    const close = after.indexOf("```");
    if (close >= 0) return after.slice(0, close).trim();
  }
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

export function gscManualAiPayloadToMarkdown(args: {
  siteName: string;
  siteUrl: string;
  filenames: string[];
  truncatedInput: boolean;
  payload: GscManualAiPayload;
}): string {
  const { siteName, siteUrl, filenames, truncatedInput, payload } = args;
  const lines: string[] = [];
  lines.push(`# GSC manual import - AI summary`);
  lines.push("");
  lines.push(`- **Property:** ${siteName}`);
  lines.push(`- **URL:** ${siteUrl}`);
  if (filenames.length) {
    lines.push(`- **Files:** ${filenames.join(", ")}`);
  }
  if (truncatedInput) {
    lines.push(`- **Note:** Source CSV text was truncated for the AI context window.`);
  }
  lines.push("");
  lines.push(`## Executive Summary`);
  lines.push("");
  lines.push(payload.executiveSummary);
  lines.push("");
  lines.push(`## Top opportunities (max ${GSC_MANUAL_MAX_TOP_ROWS})`);
  lines.push("");
  for (const t of payload.topOpportunities) {
    lines.push(`### ${t.rank}. ${t.label}`);
    lines.push("");
    lines.push(`- **Metrics (from CSV):** ${t.metrics}`);
    lines.push(`- **Why it matters:** ${t.why}`);
    if (t.evidence?.length) {
      lines.push(`- **Evidence (verbatim rows from export):**`);
      for (const ev of t.evidence) {
        lines.push(`  - ${ev}`);
      }
    }
    lines.push("");
  }
  if (payload.topOpportunities.length === 0) {
    lines.push(`_None extracted._`);
    lines.push("");
  }
  lines.push(`## Clusters (max ${GSC_MANUAL_MAX_CLUSTERS})`);
  lines.push("");
  for (const c of payload.clusters) {
    lines.push(`### ${c.name}`);
    lines.push("");
    lines.push(`- **Examples:** ${c.examples.map((e) => `"${e.replace(/"/g, '\\"')}"`).join(", ")}`);
    lines.push(`- **Aggregate:** ${c.aggregate}`);
    lines.push("");
  }
  if (payload.clusters.length === 0) {
    lines.push(`_None extracted._`);
    lines.push("");
  }
  return lines.join("\n");
}

export function parseAndValidateGscManualAiJson(raw: string): GscManualAiPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObjectFromModelText(raw));
  } catch {
    throw new Error("AI response was not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI JSON must be an object.");
  }
  const o = parsed as Record<string, unknown>;
  const executiveSummary = o.executiveSummary;
  if (!isNonEmptyString(executiveSummary)) {
    throw new Error("AI JSON missing executiveSummary.");
  }
  if (executiveSummary.length > GSC_MANUAL_MAX_SUMMARY_CHARS + 500) {
    throw new Error(`executiveSummary exceeds ${GSC_MANUAL_MAX_SUMMARY_CHARS} characters.`);
  }

  const top = o.topOpportunities;
  if (!Array.isArray(top)) throw new Error("topOpportunities must be an array.");
  if (top.length > GSC_MANUAL_MAX_TOP_ROWS) {
    throw new Error(`topOpportunities has more than ${GSC_MANUAL_MAX_TOP_ROWS} rows.`);
  }
  const topOpportunities: GscManualAiTopRow[] = [];
  for (let i = 0; i < top.length; i++) {
    const row = top[i];
    if (!row || typeof row !== "object") throw new Error(`topOpportunities[${i}] invalid.`);
    const r = row as Record<string, unknown>;
    const rank = typeof r.rank === "number" ? r.rank : Number(r.rank);
    if (!Number.isFinite(rank)) throw new Error(`topOpportunities[${i}].rank invalid.`);
    if (!isNonEmptyString(r.label) || !isNonEmptyString(r.why) || !isNonEmptyString(r.metrics)) {
      throw new Error(`topOpportunities[${i}] missing label, why, or metrics.`);
    }
    const evRaw = r.evidence;
    if (!Array.isArray(evRaw) || evRaw.length === 0) {
      throw new Error(`topOpportunities[${i}] must include a non-empty evidence array (verbatim CSV lines).`);
    }
    if (evRaw.length > GSC_MANUAL_MAX_EVIDENCE_LINES) {
      throw new Error(`topOpportunities[${i}] has too many evidence lines.`);
    }
    const evidence: string[] = [];
    for (let j = 0; j < evRaw.length; j++) {
      if (!isNonEmptyString(evRaw[j])) throw new Error(`topOpportunities[${i}].evidence[${j}] invalid.`);
      const line = String(evRaw[j]).trim();
      if (line.length > GSC_MANUAL_MAX_EVIDENCE_LINE_CHARS) {
        throw new Error(`topOpportunities[${i}].evidence[${j}] exceeds max length.`);
      }
      evidence.push(line);
    }
    topOpportunities.push({
      rank,
      label: r.label.trim(),
      why: r.why.trim(),
      metrics: r.metrics.trim(),
      evidence,
    });
  }

  const cl = o.clusters;
  if (!Array.isArray(cl)) throw new Error("clusters must be an array.");
  if (cl.length > GSC_MANUAL_MAX_CLUSTERS) {
    throw new Error(`clusters has more than ${GSC_MANUAL_MAX_CLUSTERS} items.`);
  }
  const clusters: GscManualAiCluster[] = [];
  for (let i = 0; i < cl.length; i++) {
    const c = cl[i];
    if (!c || typeof c !== "object") throw new Error(`clusters[${i}] invalid.`);
    const r = c as Record<string, unknown>;
    if (!isNonEmptyString(r.name) || !isNonEmptyString(r.aggregate)) {
      throw new Error(`clusters[${i}] missing name or aggregate.`);
    }
    const examples = r.examples;
    if (!Array.isArray(examples)) throw new Error(`clusters[${i}].examples must be an array.`);
    if (examples.length > GSC_MANUAL_MAX_EXAMPLES_PER_CLUSTER) {
      throw new Error(`clusters[${i}] has too many examples.`);
    }
    const ex: string[] = [];
    for (let j = 0; j < examples.length; j++) {
      if (!isNonEmptyString(examples[j])) throw new Error(`clusters[${i}].examples[${j}] invalid.`);
      ex.push(String(examples[j]).trim());
    }
    clusters.push({ name: r.name.trim(), examples: ex, aggregate: r.aggregate.trim() });
  }

  const payload: GscManualAiPayload = {
    executiveSummary: executiveSummary.trim(),
    topOpportunities,
    clusters,
  };

  const md = gscManualAiPayloadToMarkdown({
    siteName: "_",
    siteUrl: "_",
    filenames: [],
    truncatedInput: false,
    payload,
  });
  if (md.length > GSC_MANUAL_MAX_OUTPUT_CHARS) {
    throw new Error("Rendered summary exceeds maximum size.");
  }

  return payload;
}

export type RunGscManualAiAggregateArgs = {
  apiKey: string;
  model: string;
  siteName: string;
  siteUrl: string;
  files: { name: string; content: string }[];
  signal?: AbortSignal;
};

/**
 * Single AI pass: bundled CSV text → JSON → validated → markdown for KB.
 * Throws on any failure (no KB write by caller).
 */
export async function runGscManualAiAggregate(args: RunGscManualAiAggregateArgs): Promise<string> {
  const { apiKey, model, siteName, siteUrl, files, signal } = args;
  if (!apiKey.trim()) {
    throw new Error("OpenRouter API key is required.");
  }
  if (files.length === 0) {
    throw new Error("No files to process.");
  }
  const nonEmpty = files.filter((f) => f.content.trim().length > 0);
  if (nonEmpty.length === 0) {
    throw new Error("All uploaded files are empty.");
  }

  const { text, truncated, filenames } = bundleGscManualFilesForPrompt(nonEmpty);
  const userMessage = `Site: ${siteName} (${siteUrl})

Below are the CSV file contents. Analyze and produce the JSON object as specified in your system instructions.

${text}`;

  const maxTokens = Math.min(24_000, getCompetitorReportMaxOutputTokens(model));

  const { content } = await callOpenRouterChatCompletion({
    apiKey,
    model,
    system: SYSTEM_PROMPT,
    user: userMessage,
    maxTokens,
    signal,
  });

  const payload = parseAndValidateGscManualAiJson(content);
  return gscManualAiPayloadToMarkdown({
    siteName,
    siteUrl,
    filenames,
    truncatedInput: truncated,
    payload,
  });
}
