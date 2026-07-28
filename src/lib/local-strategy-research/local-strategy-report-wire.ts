import type {
  CompetitorResearchSemrushResponse,
  GscCompetitorDateRange,
  GscSiteQueryRow,
  TieredCompetitorsResult,
} from "@/lib/competitor-research/types";
import type {
  ProposalFaqAuditWire,
  ProposalSiteAuditWire,
} from "@/lib/research/proposal-site-audit-types";
import { DEFAULT_LOCAL_STRATEGY_PLAN_MONTHS, clampPlanMonths } from "@/lib/research/plan-months";

/** Slimmed GMB snapshot from Google OAuth performance (optional). */
export type LocalStrategyGmbOauthWire = {
  locationCount?: number;
  currentPeriod?: {
    startDate?: string;
    endDate?: string;
    calls?: number;
    directions?: number;
    websiteClicks?: number;
  };
  comparisonPeriod?: {
    startDate?: string;
    endDate?: string;
    calls?: number;
    directions?: number;
    websiteClicks?: number;
  };
};

export type LocalStrategyWirePayload = {
  ls: {
    seedUrl: string | null;
    seedDomain: string;
    clientLabel: string | null;
    businessNameQuery: string;
    /** User-facing region label (e.g. Georgia, United States). */
    geoLabel: string | null;
    /** Plan horizon in months (must match strategist H1 and opening copy). */
    planMonths: number;
  };
  /** DataForSEO Labs organic snapshot (abbrev. `dfs` in legend). */
  dfs: {
    database: string;
    dataSource: "dfs" | "semrush";
    seedMetrics: CompetitorResearchSemrushResponse["seedMetrics"];
    seedOverview: CompetitorResearchSemrushResponse["seedOverview"];
    competitorRows: Array<{
      domain: string;
      organicTraffic: number | null;
      organicKeywords: number | null;
      trafficCost: number | null;
    }>;
    seedKeywordSample: string[];
    tierSummary: string;
  };
  /** Google Business Profile: DataForSEO + optional OAuth performance. */
  gmb: {
    dfs: unknown;
    oauth: LocalStrategyGmbOauthWire | null;
  };
  gsc: {
    queries: GscSiteQueryRow[];
    dateRange: GscCompetitorDateRange | null;
    demandNote: string;
  };
  /** Lighthouse averages from proposal site audit (optional). */
  perf?: ProposalSiteAuditWire | null;
  /** FAQ inventory from proposal site audit (optional). */
  faq?: ProposalFaqAuditWire | null;
};

export const LOCAL_STRATEGY_WIRE_LEGEND_LINE =
  "ls=local meta (incl. planMonths); dfs=organic Labs/Semrush snapshot; gmb.dfs=DataForSEO google_business_info JSON; gmb.oauth=optional GBP Performance snapshot; gsc=Search Console queries + range; perf=Lighthouse sample averages (desktop+mobile); faq=FAQ inventory from crawled pages; decode JSON only from user message.";

const MAX_COMPETITOR_ROWS = 12;
const MAX_GSC_QUERIES = 120;
const MAX_SEED_KW_SAMPLES = 40;

export function buildLocalStrategyWirePayload(args: {
  semrush: CompetitorResearchSemrushResponse;
  tiers: TieredCompetitorsResult;
  siteUrl: string | null;
  clientLabel: string | null;
  businessNameQuery: string;
  geoLabel: string | null;
  gmbDfsRaw: unknown;
  gmbOauth: LocalStrategyGmbOauthWire | null;
  gscQueries: GscSiteQueryRow[];
  gscDateRange: GscCompetitorDateRange | null;
  gqDemandSource: "gsc" | "dfs_seed";
  planMonths?: number;
  siteAudit?: {
    perf: ProposalSiteAuditWire | null;
    faq: ProposalFaqAuditWire | null;
  } | null;
}): LocalStrategyWirePayload {
  const {
    semrush,
    tiers,
    siteUrl,
    clientLabel,
    businessNameQuery,
    geoLabel,
  } = args;

  const rows = (semrush.rows ?? []).slice(0, MAX_COMPETITOR_ROWS);
  const sk = semrush.seedTopKeywords ?? [];
  const seedSample = sk
    .slice(0, MAX_SEED_KW_SAMPLES)
    .map((r) => r.phrase)
    .filter((p) => typeof p === "string" && p.trim().length > 0);

  const ds: "dfs" | "semrush" =
    semrush.dataSource === "dfs" || semrush.database === "dfs" ? "dfs" : "semrush";

  const planMonths = clampPlanMonths(args.planMonths, DEFAULT_LOCAL_STRATEGY_PLAN_MONTHS);

  const demandNote =
    args.gqDemandSource === "dfs_seed"
      ? "gsc.queries are organic demand proxies from seed ranked keywords (not Google Search Console)."
      : "gsc.queries are from Google Search Console when available.";

  return {
    ls: {
      seedUrl: siteUrl,
      seedDomain: semrush.seedDomain,
      clientLabel: clientLabel,
      businessNameQuery: businessNameQuery.trim() || clientLabel || semrush.seedDomain,
      geoLabel: geoLabel?.trim() || null,
      planMonths,
    },
    dfs: {
      database: semrush.database,
      dataSource: ds,
      seedMetrics: semrush.seedMetrics ?? null,
      seedOverview: semrush.seedOverview ?? null,
      competitorRows: rows.map((r) => ({
        domain: r.domain,
        organicTraffic: r.organicTraffic,
        organicKeywords: r.organicKeywords,
        trafficCost: r.trafficCost,
      })),
      seedKeywordSample: seedSample,
      tierSummary: tiers.summary,
    },
    gmb: {
      dfs: args.gmbDfsRaw,
      oauth: args.gmbOauth,
    },
    gsc: {
      queries: [...args.gscQueries]
        .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
        .slice(0, MAX_GSC_QUERIES),
      dateRange: args.gscDateRange,
      demandNote,
    },
    ...(args.siteAudit?.perf ? { perf: args.siteAudit.perf } : {}),
    ...(args.siteAudit?.faq ? { faq: args.siteAudit.faq } : {}),
  };
}
