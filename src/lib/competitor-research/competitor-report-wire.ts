import { COMPETITOR_BULK_CSV_TOTAL_POSTS } from "@/lib/competitor-research/competitor-bulk-content-csv";
import type { GqDemandSource } from "@/lib/competitor-research/competitor-report-system-prompt";
import { normalizeCompetitorDomainKey } from "@/lib/competitor-research/competitor-domain-key";
import type {
  CompetitorDomainEnrichment,
  CompetitorKeywordRow,
  CompetitorResearchSemrushResponse,
  GscCompetitorDateRange,
  GscSiteQueryRow,
  SemrushCompetitorRow,
  TieredCompetitorsResult,
} from "@/lib/competitor-research/types";

/** Max chars per tier rationale on the wire (`Rsn`). */
export const REPORT_WIRE_RSN_MAX = 280;
/** Max chars for `ta.Sum`. */
export const REPORT_WIRE_TA_SUM_MAX = 2000;
/** Max chars for combined notes field `n`. */
export const REPORT_WIRE_NOTES_MAX = 900;

/**
 * Single-line legend for the model (decode abbrev SEO tokens).
 * Matches the **serialized** OpenRouter user JSON: `scv`/`ekM` keys, `ssc`+`scv` row sep RS (0x1E), `ekr` col0 = index into `dm`.
 */
export const REPORT_WIRE_LEGEND_LINE =
  "sm:OKw,OTr;so:AS,RD,BL;kc:Kw,Vol,Tr,Pos;sk;skM;src:Dom,CK,OTr,OKw,Comp,AS,RD,BL;sr;ekc;dm;ekr:Di,Kw,Vol,Tr,Pos;ekM;tp:sTr,sVol,kwR,Pt,N,avgCompOTr,nCompOTr,seedOTr,gapTr,rM,rS,rD;ssc;scv:RS;gc;gq;ta;tcc:Dom,Scr,Rsn;dg;lb;n;err;gdr;cl,sn,su";

export type CompetitorReportWirePayload = {
  sd: string;
  db: string;
  sm: { OKw: number | null; OTr: number | null } | null;
  so: { AS: number | null; RD: number | null; BL: number | null } | null;
  kc: ["Kw", "Vol", "Tr", "Pos"];
  sk: Array<[string, number | null, number | null, number | null]>;
  /** Parallel to sk: Semrush member phrases per aggregated cluster row (empty when not clustered). */
  skM?: string[][];
  src: ["Dom", "CK", "OTr", "OKw", "Comp", "AS", "RD", "BL"];
  sr: Array<
    [
      string,
      number | null,
      number | null,
      number | null,
      number | null,
      number | null,
      number | null,
      number | null,
    ]
  >;
  ekc: ["Dom", "Kw", "Vol", "Tr", "Pos"];
  /** Unique competitor domains in stable order (same order as enrichment iteration); `ekr` col0 indexes this array. */
  dm: string[];
  /** Semantic clusters per competitor; col0 = index into `dm`, then phrase, Vol, Tr, best Pos. */
  ekr: Array<[number, string, number | null, number | null, number | null]>;
  /** Parallel to ekr: member phrases per aggregated cluster row (empty when not clustered). */
  ekrM?: string[][];
  gc: ["Qry", "Clk", "Imp", "CTR", "Pos"];
  gq: Array<[string, number, number, number, number]>;
  ta: {
    Sum: string;
    tcc: ["Dom", "Scr", "Rsn"];
    ti: Array<{
      Tier: "high" | "medium" | "low";
      Lbl: string;
      Comps: Array<[string, number, string]>;
    }>;
  };
  dg: {
    skc: number;
    gqc: number;
    overlap: string;
    errc: number;
  };
  lb: string;
  n: string;
  err: CompetitorResearchSemrushResponse["errors"];
  gdr: GscCompetitorDateRange | null;
  cl: string | null;
  sn: string | undefined;
  su: string | undefined;
  /** Seed `domain_organic` top phrases as CSV (Semrush API via server). */
  ssc: string;
  /** Competitor domain → same CSV format as `ssc` (top phrases per domain). */
  scsv: Record<string, string>;
  /**
   * Reference pool for traffic-potential narrative: sums of Semrush Tr/Vol over clustered `sk` + `ekr` rows,
   * plus peer-average benchmarks from `sr` OTr vs seed. Matrix Anchor Demand is net-new intent; estimates are directional, not guarantees.
   */
  tp: {
    /** Sum of monthly organic traffic (Tr) where finite; null if no row had a finite Tr. */
    sTr: number | null;
    /** Sum of search volume (Vol) where finite; null if no row had a finite Vol. */
    sVol: number | null;
    /** Row count: sk.length + ekr.length. */
    kwR: number;
    /** Planned posts in the 3-month matrix (same as Content Opportunity Matrix row count). */
    Pt: number;
    /** Mean monthly organic traffic across competitor `sr` rows (OTr); null if none finite. */
    avgCompOTr: number | null;
    /** Count of `sr` rows with finite OTr. */
    nCompOTr: number;
    /** Same as sm.OTr; duplicate for section 4 without cross-referencing sm. */
    seedOTr: number | null;
    /** max(0, avgCompOTr - seedOTr) when both finite; headroom toward peer average. */
    gapTr: number | null;
    /** Suggested incremental monthly visit range [lo,hi] for Moderate scenario; null if uncomputable. */
    rM: [number, number] | null;
    /** Significant scenario (between Moderate and Drastic). */
    rS: [number, number] | null;
    /** Drastic scenario (highest tier). */
    rD: [number, number] | null;
    /** Short static explanation for the writer. */
    N: string;
  };
};

function capStr(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function kwTuple(k: CompetitorKeywordRow): [string, number | null, number | null, number | null] {
  return [k.phrase, k.volume, k.traffic, k.position];
}

function slimSeedMetrics(
  m: CompetitorResearchSemrushResponse["seedMetrics"],
): CompetitorReportWirePayload["sm"] {
  if (!m) return null;
  return { OKw: m.organicKeywords ?? null, OTr: m.organicTraffic ?? null };
}

function slimSeedOverview(
  o: CompetitorResearchSemrushResponse["seedOverview"],
): CompetitorReportWirePayload["so"] {
  if (!o) return null;
  return { AS: o.authorityScore ?? null, RD: o.referringDomains ?? null, BL: o.backlinksTotal ?? null };
}

/** Competitor row fields from Semrush (organic competitors; link columns optional / often null). */
function slimSemrushRowTuple(r: SemrushCompetitorRow): CompetitorReportWirePayload["sr"][0] {
  return [
    r.domain,
    r.commonKeywords ?? null,
    r.organicTraffic ?? null,
    r.organicKeywords ?? null,
    r.competitionLevel ?? null,
    r.authorityScore ?? null,
    r.referringDomains ?? null,
    r.backlinksTotal ?? null,
  ];
}

/** Flatten enrichment to ekr rows: phrase/vol/tr/pos come from Semrush domain_organic table parse (server). */
function csvMapForReportDomains(
  csvByDomain: CompetitorResearchSemrushResponse["domainOrganicCsvByDomain"],
  reportDomainKeys: Set<string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!csvByDomain) return out;
  for (const [k, v] of Object.entries(csvByDomain)) {
    const nk = normalizeCompetitorDomainKey(k);
    if (reportDomainKeys.has(nk) && typeof v === "string") out[nk] = v;
  }
  return out;
}

/** Aggregate Tr/Vol from wire keyword tuples (clustered seed + competitor enrichment). */
export function aggregateTrafficPotentialFromSkEkr(
  sk: CompetitorReportWirePayload["sk"],
  ekr: CompetitorReportWirePayload["ekr"],
): Pick<CompetitorReportWirePayload["tp"], "sTr" | "sVol" | "kwR"> {
  const trs: number[] = [];
  const vols: number[] = [];
  for (const t of sk) {
    const vol = t[1];
    const tr = t[2];
    if (typeof vol === "number" && Number.isFinite(vol)) vols.push(vol);
    if (typeof tr === "number" && Number.isFinite(tr)) trs.push(tr);
  }
  for (const row of ekr) {
    const vol = row[2];
    const tr = row[3];
    if (typeof vol === "number" && Number.isFinite(vol)) vols.push(vol);
    if (typeof tr === "number" && Number.isFinite(tr)) trs.push(tr);
  }
  const kwR = sk.length + ekr.length;
  return {
    sTr: trs.length ? trs.reduce((a, b) => a + b, 0) : null,
    sVol: vols.length ? vols.reduce((a, b) => a + b, 0) : null,
    kwR,
  };
}

/** Minimum scale (monthly visits) for fallback tiers when gapTr is zero but cluster/seed signals exist. */
const TP_RANGE_MIN_SCALE = 40;

/**
 * Peer-average organic traffic from competitor rows (`sr` col OTr), gap vs seed, and suggested
 * incremental monthly visit bands for Moderate / Significant / Drastic (ordered low to high).
 */
export function computeTrafficPotentialPeerBenchmarks(args: {
  sr: CompetitorReportWirePayload["sr"];
  seedOTr: number | null;
  sTr: number | null;
}): Pick<
  CompetitorReportWirePayload["tp"],
  "avgCompOTr" | "nCompOTr" | "seedOTr" | "gapTr" | "rM" | "rS" | "rD"
> {
  const otrs: number[] = [];
  for (const row of args.sr) {
    const o = row[2];
    if (typeof o === "number" && Number.isFinite(o) && o >= 0) otrs.push(o);
  }
  const nCompOTr = otrs.length;
  const avgCompOTr = nCompOTr ? otrs.reduce((a, b) => a + b, 0) / nCompOTr : null;

  const seedOTr =
    typeof args.seedOTr === "number" && Number.isFinite(args.seedOTr) && args.seedOTr >= 0
      ? args.seedOTr
      : null;

  let gapTr: number | null = null;
  if (avgCompOTr != null && seedOTr != null) {
    gapTr = Math.max(0, avgCompOTr - seedOTr);
  }

  let scale: number | null = null;
  if (gapTr != null && gapTr > 0) {
    scale = gapTr;
  } else {
    const fromCluster = args.sTr != null && args.sTr > 0 ? args.sTr * 0.03 : 0;
    const fromPeerAvg = avgCompOTr != null && avgCompOTr > 0 ? avgCompOTr * 0.25 : 0;
    const fromSeed = seedOTr != null && seedOTr > 0 ? seedOTr * 0.01 : 0;
    const raw = Math.max(fromCluster, fromPeerAvg, fromSeed);
    if (raw > 0) {
      scale = Math.max(raw, TP_RANGE_MIN_SCALE);
    }
  }

  let rM: [number, number] | null = null;
  let rS: [number, number] | null = null;
  let rD: [number, number] | null = null;

  if (scale != null && scale > 0) {
    const tier = (lo: number, hi: number): [number, number] => [
      Math.max(0, Math.round(lo)),
      Math.max(0, Math.round(hi)),
    ];
    rM = tier(0.12 * scale, 0.22 * scale);
    rS = tier(0.22 * scale, 0.45 * scale);
    rD = tier(0.45 * scale, 0.75 * scale);
    if (rM[0] > rM[1]) rM = [rM[1], rM[0]];
    if (rS[0] > rS[1]) rS = [rS[1], rS[0]];
    if (rD[0] > rD[1]) rD = [rD[1], rD[0]];
  }

  return {
    avgCompOTr,
    nCompOTr,
    seedOTr,
    gapTr,
    rM,
    rS,
    rD,
  };
}

/** Flatten enrichment to `dm`, `ekr` (domain index + phrase metrics), and parallel `ekrM` member lists. */
export function flattenEnrichmentAndMembers(
  enrichment: Record<string, CompetitorDomainEnrichment>,
): { dm: string[]; ekr: CompetitorReportWirePayload["ekr"]; ekrM: string[][] } {
  const rows: CompetitorReportWirePayload["ekr"] = [];
  const ekrM: string[][] = [];
  const keys = Object.keys(enrichment).sort((a, b) => a.localeCompare(b));
  const dm = keys.map((k) => normalizeCompetitorDomainKey(k));
  for (let di = 0; di < keys.length; di++) {
    const domain = keys[di];
    const enr = enrichment[domain];
    for (const k of enr?.topKeywords ?? []) {
      const [phrase, vol, tr, pos] = kwTuple(k);
      rows.push([di, phrase, vol, tr, pos]);
      ekrM.push(k.clusterMembers ?? []);
    }
  }
  return { dm, ekr: rows, ekrM };
}

export function flattenEnrichment(
  enrichment: Record<string, CompetitorDomainEnrichment>,
): CompetitorReportWirePayload["ekr"] {
  return flattenEnrichmentAndMembers(enrichment).ekr;
}

/**
 * Summarize step may rewrite or hallucinate sk/sr/ekr/dm/gq/skM/ekrM. Always restore those arrays
 * from the canonical wire built client-side (domain filter, traffic sort, per-domain cap).
 * OpenRouter-only aliases `scv`/`ekM` are stripped if the model echoes them.
 */
export function mergeSummarizedWirePreserveDataTables(
  wire: CompetitorReportWirePayload,
  summarized: unknown,
): CompetitorReportWirePayload {
  if (!summarized || typeof summarized !== "object" || Array.isArray(summarized)) {
    return wire;
  }
  const s = summarized as Partial<CompetitorReportWirePayload> & Record<string, unknown>;
  const merged: CompetitorReportWirePayload = {
    ...wire,
    ...s,
    sk: wire.sk,
    skM: wire.skM,
    sr: wire.sr,
    ekr: wire.ekr,
    ekrM: wire.ekrM,
    dm: wire.dm,
    gq: wire.gq,
    ssc: wire.ssc,
    scsv: wire.scsv,
    tp: wire.tp,
  };
  delete (merged as Record<string, unknown>).scv;
  delete (merged as Record<string, unknown>).ekM;
  return merged;
}

export function buildCompetitorReportWirePayload(args: {
  semrush: CompetitorResearchSemrushResponse;
  reportRows: SemrushCompetitorRow[];
  seedTopKeywords: CompetitorKeywordRow[];
  enrichmentByDomain: Record<string, CompetitorDomainEnrichment>;
  tierAnalysis: TieredCompetitorsResult;
  gscForReport: GscSiteQueryRow[];
  gscDateRange: GscCompetitorDateRange | null;
  clientLabel: string | null;
  siteName?: string;
  siteUrl?: string;
  reportCompetitorLimitNote: string;
  competitorKeywordSortNote: string;
  competitorSiteAlignmentNote: string;
  reportLinkBudgetAssumptionFor3MonthTable: string;
  /** When temp seed mode, `gq` is synthetic demand from ranked keywords, not Search Console. */
  gqDemandSource?: GqDemandSource;
}): CompetitorReportWirePayload {
  const sk = args.seedTopKeywords.map(kwTuple);
  const skM = args.seedTopKeywords.map((k) => k.clusterMembers ?? []);
  const sr = args.reportRows.map(slimSemrushRowTuple);
  const { dm, ekr, ekrM } = flattenEnrichmentAndMembers(args.enrichmentByDomain);
  const gq = args.gscForReport.map(
    (q): [string, number, number, number, number] => [
      q.query,
      q.clicks,
      q.impressions,
      q.ctr,
      q.position,
    ],
  );

  const ti = args.tierAnalysis.tiers.map((g) => ({
    Tier: g.tier,
    Lbl: g.label,
    Comps: g.competitors.map((c): [string, number, string] => [
      normalizeCompetitorDomainKey(c.domain),
      c.score,
      capStr(c.rationale, REPORT_WIRE_RSN_MAX),
    ]),
  }));

  const ta: CompetitorReportWirePayload["ta"] = {
    Sum: capStr(args.tierAnalysis.summary, REPORT_WIRE_TA_SUM_MAX),
    tcc: ["Dom", "Scr", "Rsn"],
    ti,
  };

  const gqSrc = args.gqDemandSource ?? "gsc";
  const dg = {
    skc: args.seedTopKeywords.length,
    gqc: args.gscForReport.length,
    overlap:
      gqSrc === "dfs_seed"
        ? "CK overlap vs seed; ekr semantic clusters (competitor); sk seed clusters; ekrM/skM member phrases when present. gqc: gq rows are ranked-keyword demand proxies from the seed API (not Google Search Console); when gqc>0, gq is existing demand for seed over gdr as synthetic metrics."
        : "CK overlap vs seed; ekr semantic clusters (competitor); sk seed clusters; ekrM/skM member phrases when present. gqc: gq GSC query rows; when gqc>0, gq is existing demand for seed over gdr.",
    errc: (args.semrush.errors ?? []).length,
  };

  const nRaw = [
    args.reportCompetitorLimitNote,
    args.competitorKeywordSortNote,
    args.competitorSiteAlignmentNote,
    gqSrc === "dfs_seed"
      ? "gq tuples are organic demand proxies from seed ranked keywords (Labs/Semrush metrics), not Search Console queries."
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const n = capStr(nRaw, REPORT_WIRE_NOTES_MAX);

  const reportDomainKeys = new Set(args.reportRows.map((r) => normalizeCompetitorDomainKey(r.domain)));
  const ssc = (args.semrush.seedDomainOrganicCsv ?? "").trim();
  const scsv = csvMapForReportDomains(args.semrush.domainOrganicCsvByDomain, reportDomainKeys);

  const tpAgg = aggregateTrafficPotentialFromSkEkr(sk, ekr);
  const smForTp = slimSeedMetrics(args.semrush.seedMetrics ?? null);
  const peerTp = computeTrafficPotentialPeerBenchmarks({
    sr,
    seedOTr: smForTp?.OTr ?? null,
    sTr: tpAgg.sTr,
  });
  const tpN = capStr(
    "avgCompOTr: mean monthly organic traffic across sr competitors (OTr). gapTr: headroom toward that average vs seed (sm). rM/rS/rD: suggested incremental monthly visit ranges for Moderate/Significant/Drastic. sTr/sVol: summed cluster-keyword pools from sk+ekr. Matrix Anchor Demand is net-new intent - ranges are directional estimates not guarantees.",
    520,
  );
  const tp: CompetitorReportWirePayload["tp"] = {
    ...tpAgg,
    ...peerTp,
    Pt: COMPETITOR_BULK_CSV_TOTAL_POSTS,
    N: tpN,
  };

  return {
    sd: args.semrush.seedDomain,
    db: args.semrush.database,
    sm: smForTp,
    so: slimSeedOverview(args.semrush.seedOverview ?? null),
    kc: ["Kw", "Vol", "Tr", "Pos"],
    sk,
    skM,
    src: ["Dom", "CK", "OTr", "OKw", "Comp", "AS", "RD", "BL"],
    sr,
    ekc: ["Dom", "Kw", "Vol", "Tr", "Pos"],
    dm,
    ekr,
    ekrM,
    ssc,
    scsv,
    gc: ["Qry", "Clk", "Imp", "CTR", "Pos"],
    gq,
    ta,
    dg,
    lb: capStr(args.reportLinkBudgetAssumptionFor3MonthTable, 520),
    n,
    err: args.semrush.errors ?? [],
    gdr: args.gscDateRange,
    cl: args.clientLabel,
    sn: args.siteName,
    su: args.siteUrl,
    tp,
  };
}

/**
 * Slim wire for OpenRouter **section 4** (Estimated Traffic Potential) only. The full wire is large; when it
 * shares the request with long system prompts, providers often return `finishReason: "length"` with
 * almost no completion text - table rows never appear. Omits ekr, dm, ssc, scv, n, err; caps sk/skM/gq.
 */
export const REPORT_WIRE_LEGEND_LINE_SECTION3 =
  "L: decode JSON. Keys: sd,db,sm,so,kc,sk,skM,src,sr,tp,ta,dg,gq,lb,gdr,cl,sn,su,gc. sk/skM=seed keywords; sr=competitor rows; tp=sTr,sVol,kwR,Pt,N,avgCompOTr,nCompOTr,seedOTr,gapTr,rM,rS,rD; rM/rS/rD=[lo,hi] incremental monthly visits; ta=tier summary; gq=GSC top queries.";

export function buildSlimWirePayloadForStrategistSection3(wire: Record<string, unknown>): Record<string, unknown> {
  const gq = Array.isArray(wire.gq) ? wire.gq.slice(0, 100) : [];
  const sk = Array.isArray(wire.sk) ? wire.sk.slice(0, 100) : [];
  const skM = Array.isArray(wire.skM) ? wire.skM.slice(0, 100) : [];
  let ta: unknown = wire.ta;
  if (wire.ta && typeof wire.ta === "object" && !Array.isArray(wire.ta)) {
    const t = wire.ta as { Sum?: string; tcc?: unknown; ti?: unknown };
    const Sum = typeof t.Sum === "string" ? capStr(t.Sum, 1500) : t.Sum;
    ta = { ...t, Sum };
  }

  return {
    sd: wire.sd,
    db: wire.db,
    sm: wire.sm,
    so: wire.so,
    kc: wire.kc,
    sk,
    skM,
    src: wire.src,
    sr: wire.sr,
    tp: wire.tp,
    ta,
    dg: wire.dg,
    gq,
    lb: wire.lb,
    gdr: wire.gdr,
    cl: wire.cl,
    sn: wire.sn,
    su: wire.su,
    gc: wire.gc,
  };
}
