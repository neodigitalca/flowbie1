import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import type { CompetitorGridPlaceRow } from "@/lib/competitor-research/local-dominator-grid-parse";
import type { WordPressSite } from "@/components/integrations/types";
import type { CompetitorComparisonHarnessGroup } from "@/lib/competitor-analysis/competitor-comparison-harness-state";

export type CompetitorPageMeta = {
  url: string;
  title: string;
  metaDescription: string;
  bodySnippet: string;
};

export type CompetitorSiteProfile = {
  businessName: string;
  domain: string | null;
  homepageUrl: string | null;
  sitemapUrl: string | null;
  services: string[];
  categories: string[];
  metaPatterns: string[];
  topPages: CompetitorPageMeta[];
};

export type ConnectedSiteProfile = {
  siteName: string;
  siteUrl: string;
  services: string[];
  metaPatterns: string[];
  samplePages: Array<{ title: string; url: string; metaDescription?: string }>;
};

export type ServiceComparisonRow = {
  service: string;
  competitorNotes: string;
  marketNotes: string;
  connectedSiteOffers: boolean;
};

export type FeatureBenefitRow = {
  feature: string;
  typicalApproach: string;
  practicalBenefit: string;
};

export type CompetitorComparisonResult = {
  serviceComparison: ServiceComparisonRow[];
  featureBenefitTable: FeatureBenefitRow[];
  positioningNotes: string;
};

export type CompetitorWithRow = {
  place: CompetitorGridPlaceRow;
  domain: string | null;
  profile: CompetitorSiteProfile | null;
  comparison: CompetitorComparisonResult | null;
  row: CSVRow;
};

export type CompetitorGenerationProgress = {
  currentMessage: string;
  stepLog: string[];
  harnessGroups?: CompetitorComparisonHarnessGroup[];
};

export type CompetitorGenerationOptions = {
  site: WordPressSite;
  places: CompetitorGridPlaceRow[];
  keyword: string;
  promptModifier?: string;
  apiKey: string;
  model: string;
  siteId?: string;
  onRowsUpdate?: (competitors: CompetitorWithRow[]) => void;
};

export type CompetitorOrchestratorResult = {
  competitors: CompetitorWithRow[];
  suggestedTitleFormat: string;
  connectedProfile: ConnectedSiteProfile;
};

export type CompetitorProgressCallback = (
  message: string,
  harnessGroups?: CompetitorComparisonHarnessGroup[],
) => void;
