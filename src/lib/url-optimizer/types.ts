export type UrlOptimizerStatus =
  | "pending"
  | "resolved"
  | "unresolved"
  | "optimized"
  | "unchanged"
  | "error";

export type UrlOptimizerInputRow = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  csvUploadRow?: number;
};

export type UrlOptimizerContentRow = UrlOptimizerInputRow & {
  postId?: number;
  subtype?: string;
  title: string;
  meta: string;
  bodyExcerpt: string;
  focusKeyword?: string;
  contentStatus: "resolved" | "unresolved";
};

export type UrlOptimizerResultRow = Omit<UrlOptimizerContentRow, "contentStatus"> & {
  proposedKeyword?: string;
  proposedUrl?: string;
  rationale?: string;
  status: UrlOptimizerStatus;
  skipReason?: string;
  csvUploadRow?: number;
};

export type UrlOptimizerProgressPhase =
  | "idle"
  | "parse"
  | "resolve"
  | "fetch"
  | "optimize"
  | "done"
  | "error";

export type UrlOptimizerProgress = {
  phase: UrlOptimizerProgressPhase;
  completed: number;
  total: number;
  message?: string;
  detail?: string;
  uploadRowCount?: number;
};

export type UrlOptimizerRunResult = {
  rows: UrlOptimizerResultRow[];
  stats: {
    total: number;
    resolved: number;
    unresolved: number;
    changed: number;
    unchanged: number;
    errors: number;
  };
};

export type UrlOptimizerAgentProposal = {
  page: string;
  proposedPrimaryKeyword: string;
  rationale: string;
};
