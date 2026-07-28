export type LegacyUrlRow = {
  legacyUrl: string;
  uploadRow: number;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

export type LegacyEnrichedRow = LegacyUrlRow & {
  title: string;
  meta: string;
  bodyExcerpt: string;
  focusKeyword: string;
  slugTitle: string;
  grepResolved: boolean;
};

export type BlogCatalogEntry = {
  url: string;
  title: string;
  focusKeyword: string;
  meta: string;
  bodyExcerpt: string;
  slug: string;
  postId?: number;
};

export type RedirectMatcherProposal = {
  legacyUrl: string;
  matchedBlogUrl: string;
  rationale: string;
};

export type RedirectMatcherResultRow = LegacyEnrichedRow & {
  matchedBlogUrl: string;
  matchedBlogKeyword: string;
  rationale: string;
};

export type RedirectMatcherProgressPhase =
  | "idle"
  | "parse"
  | "catalog"
  | "grep"
  | "match"
  | "done"
  | "error";

export type RedirectMatcherProgress = {
  phase: RedirectMatcherProgressPhase;
  completed: number;
  total: number;
  message?: string;
  detail?: string;
  uploadRowCount?: number;
  catalogSize?: number;
};

export type RedirectMatcherRunResult = {
  rows: RedirectMatcherResultRow[];
  catalogSize: number;
  stats: {
    total: number;
    matched: number;
  };
};
