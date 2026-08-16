/**
 * Deterministic cross-metric interpretation for GSC period-compare reporting.
 * Classifies site-wide KPI patterns so agents do not treat avg position in isolation.
 */
import type { GscQueryPerfRow, GscSiteTotalsPreviousMonth } from "@/lib/gsc-reporting/gsc-reporting-fetch";
export type GscCompareKind = "mom" | "yoy" | "custom";

export type GscCompareSignalPattern =
  | "query_footprint_expansion"
  | "visibility_contraction"
  | "ctr_dilution"
  | "mixed_or_flat";

export type GscCompareSignals = {
  compareKind: GscCompareKind;
  compareLabel: string;
  primaryPattern: GscCompareSignalPattern;
  confidence: "high" | "medium" | "low";
  evidence: string[];
  interpretation: string;
  forbiddenFraming: string;
  caveats: string;
  newQueryCount: number | null;
  lostQueryCount: number | null;
  continuingQueryCount: number | null;
  headTermPositionDelta: number | null;
  metrics: {
    clicksPct: string;
    impressionsPct: string;
    queriesPct: string;
    positionPct: string;
    ctrPct: string;
  };
};

export type DeriveGscCompareSignalsInput = {
  compareKind: GscCompareKind;
  compareLabel: string;
  aggregatePrimary: GscSiteTotalsPreviousMonth | null;
  aggregateCompare: GscSiteTotalsPreviousMonth | null;
  queryCountPrimary: number;
  queryCountCompare: number;
  primaryQueries?: GscQueryPerfRow[];
  compareQueries?: GscQueryPerfRow[];
};

const PATTERN_INTERPRETATION: Record<GscCompareSignalPattern, string> = {
  query_footprint_expansion:
    "Query footprint expanded; site-wide average position diluted by new or long-tail terms.",
  visibility_contraction: "Search visibility contracted; fewer impressions with worsening average position.",
  ctr_dilution: "Impressions rose but clicks and CTR softened; visibility expanded without click efficiency.",
  mixed_or_flat: "Mixed period signals; qualify claims and avoid a single visibility headline from position alone.",
};

const PATTERN_FORBIDDEN: Partial<Record<GscCompareSignalPattern, string>> = {
  query_footprint_expansion: "Do not describe this as overall search visibility decline.",
};

function pctDelta(primary: number | null | undefined, compare: number | null | undefined): number | null {
  if (primary == null || compare == null || compare === 0) return null;
  return ((primary - compare) / compare) * 100;
}

function formatSignedPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return " - ";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function queryJoinStats(
  primaryQueries: GscQueryPerfRow[],
  compareQueries: GscQueryPerfRow[],
): {
  newQueryCount: number;
  lostQueryCount: number;
  continuingQueryCount: number;
  headTermPositionDelta: number | null;
} {
  const primaryMap = new Map<string, GscQueryPerfRow>();
  const compareMap = new Map<string, GscQueryPerfRow>();
  for (const q of primaryQueries) {
    const k = q.query.trim();
    if (k) primaryMap.set(k, q);
  }
  for (const q of compareQueries) {
    const k = q.query.trim();
    if (k) compareMap.set(k, q);
  }

  let newQueryCount = 0;
  let lostQueryCount = 0;
  let continuingQueryCount = 0;
  for (const k of primaryMap.keys()) {
    if (compareMap.has(k)) continuingQueryCount += 1;
    else newQueryCount += 1;
  }
  for (const k of compareMap.keys()) {
    if (!primaryMap.has(k)) lostQueryCount += 1;
  }

  const headTerms = [...compareMap.entries()]
    .sort((a, b) => b[1].impressions - a[1].impressions)
    .slice(0, 10)
    .map(([k]) => k);

  let headDeltaSum = 0;
  let headDeltaCount = 0;
  for (const k of headTerms) {
    const p = primaryMap.get(k);
    const c = compareMap.get(k);
    if (p && c) {
      headDeltaSum += p.position - c.position;
      headDeltaCount += 1;
    }
  }

  return {
    newQueryCount,
    lostQueryCount,
    continuingQueryCount,
    headTermPositionDelta: headDeltaCount > 0 ? headDeltaSum / headDeltaCount : null,
  };
}

function classifyPattern(args: {
  queriesPct: number | null;
  impressionsPct: number | null;
  positionPct: number | null;
  clicksPct: number | null;
  ctrPct: number | null;
  positionWorsened: boolean;
}): GscCompareSignalPattern {
  const { queriesPct, impressionsPct, positionWorsened, clicksPct, ctrPct } = args;
  const queriesUp = queriesPct != null && queriesPct > 0;
  const impUp = impressionsPct != null && impressionsPct > 0;
  const impDown = impressionsPct != null && impressionsPct < 0;
  const clkDown = clicksPct != null && clicksPct < 0;
  const ctrDown = ctrPct != null && ctrPct < 0;

  if (queriesUp && impUp && positionWorsened) return "query_footprint_expansion";
  if (impDown && positionWorsened) return "visibility_contraction";
  if (impUp && clkDown && ctrDown) return "ctr_dilution";
  return "mixed_or_flat";
}

export function deriveGscCompareSignals(input: DeriveGscCompareSignalsInput): GscCompareSignals | null {
  const p = input.aggregatePrimary;
  const c = input.aggregateCompare;
  if (!p || !c) return null;

  const clicksPct = pctDelta(p.clicks, c.clicks);
  const impressionsPct = pctDelta(p.impressions, c.impressions);
  const queriesPct = pctDelta(input.queryCountPrimary, input.queryCountCompare);
  const positionPct = pctDelta(p.position, c.position);
  const ctrPct = pctDelta(p.ctr, c.ctr);
  const positionWorsened = p.position > c.position;

  const hasQueries =
    (input.primaryQueries?.length ?? 0) > 0 || (input.compareQueries?.length ?? 0) > 0;
  const join: {
    newQueryCount: number | null;
    lostQueryCount: number | null;
    continuingQueryCount: number | null;
    headTermPositionDelta: number | null;
  } = hasQueries
    ? queryJoinStats(input.primaryQueries ?? [], input.compareQueries ?? [])
    : {
        newQueryCount: null,
        lostQueryCount: null,
        continuingQueryCount: null,
        headTermPositionDelta: null,
      };

  const primaryPattern = classifyPattern({
    queriesPct,
    impressionsPct,
    positionPct,
    clicksPct,
    ctrPct,
    positionWorsened,
  });

  const evidence: string[] = [
    `Search queries: ${formatSignedPct(queriesPct)}`,
    `Total impressions: ${formatSignedPct(impressionsPct)}`,
    `Average position: ${formatSignedPct(positionPct)} (worse when positive; lower rank number is better)`,
    `Total clicks: ${formatSignedPct(clicksPct)}`,
  ];
  if (join.newQueryCount != null) {
    evidence.push(`New queries in period A: ${join.newQueryCount}`);
  }
  if (join.headTermPositionDelta != null) {
    evidence.push(
      `Head-term avg position delta (top 10 by prior impressions): ${join.headTermPositionDelta >= 0 ? "+" : ""}${join.headTermPositionDelta.toFixed(2)}`,
    );
  }

  const confidence: GscCompareSignals["confidence"] = hasQueries ? "high" : "medium";

  return {
    compareKind: input.compareKind,
    compareLabel: input.compareLabel,
    primaryPattern,
    confidence,
    evidence,
    interpretation: PATTERN_INTERPRETATION[primaryPattern],
    forbiddenFraming:
      PATTERN_FORBIDDEN[primaryPattern] ??
      "Do not infer overall visibility loss from average position alone when impressions and query count both rose.",
    caveats:
      join.headTermPositionDelta != null
        ? "Review head-term position delta to see whether branded or high-impression terms held."
        : "Check whether top branded or head terms held when query-level data is available.",
    newQueryCount: join.newQueryCount,
    lostQueryCount: join.lostQueryCount,
    continuingQueryCount: join.continuingQueryCount,
    headTermPositionDelta: join.headTermPositionDelta,
    metrics: {
      clicksPct: formatSignedPct(clicksPct),
      impressionsPct: formatSignedPct(impressionsPct),
      queriesPct: formatSignedPct(queriesPct),
      positionPct: formatSignedPct(positionPct),
      ctrPct: formatSignedPct(ctrPct),
    },
  };
}

export function buildGscCompareSignalsContextText(signals: GscCompareSignals): string {
  const lines = [
    "COMPARE_SIGNALS (authoritative; obey in all sections)",
    `compareKind: ${signals.compareKind}`,
    `compareLabel: ${signals.compareLabel}`,
    `primaryPattern: ${signals.primaryPattern}`,
    `confidence: ${signals.confidence}`,
    "evidence:",
    ...signals.evidence.map((e) => `  - ${e}`),
    `interpretation: ${signals.interpretation}`,
    `forbiddenFraming: ${signals.forbiddenFraming}`,
    `caveats: ${signals.caveats}`,
  ];
  return lines.join("\n");
}

export function gscCompareSignalsFileContent(signals: GscCompareSignals): string {
  return `${buildGscCompareSignalsContextText(signals)}\n`;
}

export const GSC_COMPARE_SIGNALS_FILENAME = "Site-totals-compare-signals.txt";

/** Parse Site-totals-MoM.csv metric rows for manual-upload fallback. */
export function parseSiteTotalsCompareCsv(csvText: string): {
  queryCountPrimary: number;
  queryCountCompare: number;
  aggregatePrimary: GscSiteTotalsPreviousMonth | null;
  aggregateCompare: GscSiteTotalsPreviousMonth | null;
} | null {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length < 2) return null;

  const header = lines[0]!.split(",");
  if (header.length < 3 || header[0]?.trim() !== "Metric") return null;

  const colA = header[1]?.trim() ?? "";
  const colB = header[2]?.trim() ?? "";

  const metrics: Record<string, { a?: number; b?: number }> = {};
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i]!.split(",");
    const name = parts[0]?.trim();
    if (!name) continue;
    const a = parts[1]?.trim();
    const b = parts[2]?.trim();
    metrics[name] = {
      a: a && a !== " - " ? Number(a) : undefined,
      b: b && b !== " - " ? Number(b) : undefined,
    };
  }

  const clicks = metrics["Total clicks"];
  const impressions = metrics["Total impressions"];
  const queries = metrics["Search queries"];
  const ctrRaw = metrics["Average CTR"];
  const position = metrics["Average position"];

  if (!clicks?.a && clicks?.a !== 0) return null;

  const parseCtr = (v: number | undefined): number => {
    if (v == null) return 0;
    return v > 1 ? v / 100 : v;
  };

  return {
    queryCountPrimary: queries?.a ?? 0,
    queryCountCompare: queries?.b ?? 0,
    aggregatePrimary: {
      label: colA,
      startDate: "",
      endDate: "",
      clicks: clicks.a ?? 0,
      impressions: impressions?.a ?? 0,
      ctr: parseCtr(ctrRaw?.a),
      position: position?.a ?? 0,
    },
    aggregateCompare: {
      label: colB,
      startDate: "",
      endDate: "",
      clicks: clicks.b ?? 0,
      impressions: impressions?.b ?? 0,
      ctr: parseCtr(ctrRaw?.b),
      position: position?.b ?? 0,
    },
  };
}

/** Parse Queries-MoM.csv rows into primary/compare query perf arrays. */
export function parseQueriesMomCsv(csvText: string): {
  primaryQueries: GscQueryPerfRow[];
  compareQueries: GscQueryPerfRow[];
} {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length < 2) return { primaryQueries: [], compareQueries: [] };

  const header = lines[0]!.split(",");
  const queryIdx = header.findIndex((h) => h.trim() === "Query");
  if (queryIdx < 0) return { primaryQueries: [], compareQueries: [] };

  const findCol = (re: RegExp): number =>
    header.findIndex((h) => re.test(h.trim()));

  const clkA = findCol(/^Clicks \(/);
  const clkB = header.findIndex((h, i) => i > clkA && /^Clicks \(/.test(h.trim()));
  const impA = findCol(/^Impressions \(/);
  const impB = header.findIndex((h, i) => i > impA && /^Impressions \(/.test(h.trim()));
  const ctrA = findCol(/^CTR \(/);
  const posA = findCol(/^Position \(/);
  const posB = header.findIndex((h, i) => i > posA && /^Position \(/.test(h.trim()));

  const primaryQueries: GscQueryPerfRow[] = [];
  const compareQueries: GscQueryPerfRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i]!.split(",");
    const query = parts[queryIdx]?.trim();
    if (!query) continue;

    const parseNum = (idx: number): number | undefined => {
      const v = parts[idx]?.trim();
      if (!v || v === " - ") return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    const pClk = parseNum(clkA);
    const pImp = parseNum(impA);
    if (pClk != null && pImp != null) {
      primaryQueries.push({
        query,
        clicks: pClk,
        impressions: pImp,
        ctr: parseNum(ctrA) ?? (pImp > 0 ? pClk / pImp : 0),
        position: parseNum(posA) ?? 0,
      });
    }

    const cClk = parseNum(clkB);
    const cImp = parseNum(impB);
    if (cClk != null && cImp != null) {
      compareQueries.push({
        query,
        clicks: cClk,
        impressions: cImp,
        ctr: 0,
        position: parseNum(posB) ?? 0,
      });
    }
  }

  return { primaryQueries, compareQueries };
}

export function buildCompareSignalsFileFromBundle(
  files: { name: string; content: string }[],
  compareKind: GscCompareKind,
  compareLabel: string,
): { name: string; content: string } | null {
  const totalsFile = files.find(
    (f) => f.name.toLowerCase() === "site-totals-mom.csv" || f.name.toLowerCase().includes("site-totals"),
  );
  if (!totalsFile) return null;

  const parsed = parseSiteTotalsCompareCsv(totalsFile.content);
  if (!parsed) return null;

  const queriesFile = files.find(
    (f) => f.name.toLowerCase() === "queries-mom.csv" || f.name.toLowerCase().includes("queries-mom"),
  );
  const queryRows = queriesFile ? parseQueriesMomCsv(queriesFile.content) : null;

  const signals = deriveGscCompareSignals({
    compareKind,
    compareLabel,
    aggregatePrimary: parsed.aggregatePrimary,
    aggregateCompare: parsed.aggregateCompare,
    queryCountPrimary: parsed.queryCountPrimary,
    queryCountCompare: parsed.queryCountCompare,
    primaryQueries: queryRows?.primaryQueries,
    compareQueries: queryRows?.compareQueries,
  });

  if (!signals) return null;
  return { name: GSC_COMPARE_SIGNALS_FILENAME, content: gscCompareSignalsFileContent(signals) };
}

export function searchPerformanceH2ForCompareKind(compareKind: GscCompareKind): string {
  if (compareKind === "yoy") return "Search Performance Compared Year Over Year";
  if (compareKind === "custom") return "Search Performance Compared Period Over Period";
  return "Search Performance Compared Month Over Month";
}

export function ensureCompareSignalsFile(
  files: { name: string; content: string }[],
  compareKind: GscCompareKind,
  compareLabel: string,
): { name: string; content: string }[] {
  if (files.some((f) => f.name === GSC_COMPARE_SIGNALS_FILENAME)) return files;
  const built = buildCompareSignalsFileFromBundle(files, compareKind, compareLabel);
  if (!built) return files;
  return [...files, built];
}

export function buildCompareSignalsPinChunk(
  files: { name: string; content: string }[],
): { id: string; sourceFile: string; text: string } | null {
  const file = files.find((f) => f.name === GSC_COMPARE_SIGNALS_FILENAME);
  if (!file?.content.trim()) return null;
  return {
    id: "compare-signals",
    sourceFile: GSC_COMPARE_SIGNALS_FILENAME,
    text: `--- FILE: ${GSC_COMPARE_SIGNALS_FILENAME} ---\n${file.content.trim()}`,
  };
}

export const COMPARE_SIGNALS_SECTION_KINDS = new Set([
  "executive_summary",
  "search_performance_period",
  "key_performance_insights",
]);

export const COMPARE_SIGNALS_LEXICON = `**COMPARE_SIGNALS (when present in RETRIEVED DATA or RAW_DATA):** Treat \`primaryPattern\`, \`interpretation\`, and \`forbiddenFraming\` as **authoritative**. When \`primaryPattern\` is **query_footprint_expansion**, **forbidden** phrasing includes "visibility decline", "search visibility fell", and "overall visibility worsened". When Search queries rose AND impressions rose AND average position worsened, prose must mention **query discovery / footprint expansion** before noting click or position softness. Use \`compareLabel\` for period wording; do **not** say "month over month" when \`compareKind\` is **yoy**.`;
