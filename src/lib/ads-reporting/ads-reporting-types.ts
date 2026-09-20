export type AdsReportingSectionKind =
  | "executive_summary"
  | "ad_performance_period"
  | "key_performance_insights"
  | "campaign_performance"
  | "search_terms";

export type AdsReportingSectionPlan = {
  id: string;
  h2Title: string;
  kind: AdsReportingSectionKind;
  ragQuery: string;
};

export type AdsReportingOutlineResult = {
  executiveSummary: string;
  topOpportunities: Array<{
    rank: number;
    label: string;
    why: string;
    metrics: string;
    evidence?: string[];
  }>;
  sections: AdsReportingSectionPlan[];
};

export type AdsReportingChunk = {
  id: string;
  sourceFile: string;
  text: string;
};

export type AdsReportingPipelineProgress = {
  step: number;
  total: number;
  label: string;
  sectionIndex?: number;
};

export const ADS_REPORTING_PROGRESS_LABELS = {
  bundleApi: "Ads reporting bundle API",
  bundleReady: "Ads reporting bundle ready",
  outlineGenerating: "Generating report outline…",
  outlineComplete: "Outline complete",
} as const;

export type AdsReportingSectionResult = {
  plan: AdsReportingSectionPlan;
  index: number;
  markdownBlock: string;
  requestBodyJson: string;
};

export type AdsMetrics = {
  impressions: number;
  clicks: number;
  costMicros: number;
  ctr: number;
  averageCpc: number;
  conversions: number;
  conversionsValue: number;
};

export type AdsCampaignRow = AdsMetrics & {
  id: string;
  name: string;
  status: string;
};

export type AdsKeywordRow = AdsMetrics & {
  text: string;
  matchType: string;
  campaignName: string;
  adGroupName: string;
};

export type AdsSearchTermRow = AdsMetrics & {
  searchTerm: string;
  campaignName: string;
};

export type AdsReportingBundle = {
  success: true;
  customerId: string;
  startDate: string;
  endDate: string;
  compareStartDate: string;
  compareEndDate: string;
  account: AdsMetrics;
  compareAccount: AdsMetrics;
  campaigns: AdsCampaignRow[];
  compareCampaigns: AdsCampaignRow[];
  keywords: AdsKeywordRow[];
  compareKeywords: AdsKeywordRow[];
  searchTerms: AdsSearchTermRow[];
  compareSearchTerms: AdsSearchTermRow[];
};

export type AdsReportingPipelineResult = {
  markdown: string;
  outline: AdsReportingOutlineResult;
  truncatedInput: boolean;
  filenames: string[];
  sectionResults: AdsReportingSectionResult[];
  outlineRequestBodyJson: string;
};
