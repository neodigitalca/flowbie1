/** Shared types for proposal site audit (server + client). */

export type PerfAggregate = {
  sampleSize: number;
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  fcpMs: number | null;
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  speedIndexMs: number | null;
};

export type FaqPageSummary = {
  url?: string;
  hasVisibleFaq?: boolean;
  qaPairs?: Array<{ question?: string; answer?: string }>;
  hasFaqSchemaSignal?: boolean;
  gaps?: string[];
};

export type ProposalSiteAuditResult = {
  pages: { url: string }[];
  performance: {
    desktop: PerfAggregate;
    mobile: PerfAggregate;
    worstPages: Array<{
      url: string;
      device: "desktop" | "mobile";
      performanceScore: number | null;
    }>;
  };
  faq: {
    sampleSize: number;
    pagesWithFaq: number;
    totalQaPairs: number;
    pageSummaries: FaqPageSummary[];
  };
  errors: Array<{ url: string; step: string; message: string }>;
};

export type ProposalSiteAuditWire = {
  sampleSize: number;
  desktop: PerfAggregate;
  mobile: PerfAggregate;
  worstPages: ProposalSiteAuditResult["performance"]["worstPages"];
  methodologyNote: string;
};

export type ProposalFaqAuditWire = {
  sampleSize: number;
  pagesWithFaq: number;
  totalQaPairs: number;
  pageSummaries: FaqPageSummary[];
};
