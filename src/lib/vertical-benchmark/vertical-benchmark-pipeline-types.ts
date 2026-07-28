export type BenchmarkPipelineStepStatus = "waiting" | "active" | "done" | "error";

export type BenchmarkPipelineStep = {
  id: string;
  label: string;
  status: BenchmarkPipelineStepStatus;
  detail?: string;
};

/** In-session blob URL for onsite inventory JSON (open in new tab). */
export type BenchmarkInventoryHostedLink = {
  siteId: string;
  siteName: string;
  href: string;
  filename: string;
  rowCount: number;
};

export type BenchmarkPipelineProgress = {
  phase: string;
  message: string;
  percent: number;
  busy: boolean;
  indeterminate?: boolean;
  steps: BenchmarkPipelineStep[];
  /** Populated after each client inventory crawl completes. */
  inventoryLinks?: BenchmarkInventoryHostedLink[];
};

export type BenchmarkPipelineProgressCallback = (progress: BenchmarkPipelineProgress) => void;
