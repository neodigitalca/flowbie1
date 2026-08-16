import type { GscManualAiCluster, GscManualAiPayload } from "@/lib/gsc-manual-ai-aggregate";
import type { SapEntityGrounding } from "@/lib/gsc-reporting/gsc-reporting-sap-entity-context";

/** Section kinds for the full organic SEO GSC report template (outline + writers). */
export type GscReportingSectionKind =
  | "executive_summary"
  | "search_performance_period"
  | "key_performance_insights"
  | "sap_local_seo"
  | "content_performance"
  | "cluster";

export type GscReportingSectionPlan = {
  id: string;
  h2Title: string;
  kind: GscReportingSectionKind;
  /** Lexical retrieval query (title + keywords). */
  ragQuery: string;
  /** For cluster sections: index into outline clusters. */
  clusterIndex?: number;
};

export type GscReportingOutlineResult = GscManualAiPayload & {
  sections: GscReportingSectionPlan[];
};

export type GscReportingChunk = {
  id: string;
  sourceFile: string;
  text: string;
};

export type GscReportingPipelineProgress = {
  step: number;
  total: number;
  label: string;
};

export type GscReportingSectionResult = {
  plan: GscReportingSectionPlan;
  index: number;
  /** Stitched block including ## heading. */
  markdownBlock: string;
  requestBodyJson: string;
};

export type RunGscReportingPipelineArgs = {
  apiKey: string;
  model: string;
  siteName: string;
  siteUrl: string;
  files: { name: string; content: string }[];
  /** When set, SAP section retrieval pins entity sitemap allowlist + filtered Pages MoM rows. */
  sapEntityGrounding?: SapEntityGrounding;
  /** Period compare preset for canonical section titles and signal context. */
  compareKind?: import("@/lib/gsc-reporting/gsc-reporting-compare-signals").GscCompareKind;
  /** Human-readable period A vs B label for compare signals derivation. */
  compareLabel?: string;
  signal?: AbortSignal;
  onProgress?: (p: GscReportingPipelineProgress) => void;
  /** Fires after the outline OpenRouter call succeeds. */
  onOutlineReady?: (payload: {
    outline: GscReportingOutlineResult;
    outlineRequestBodyJson: string;
  }) => void;
  onSectionStart?: (index: number, plan: GscReportingSectionPlan) => void;
  onSectionReady?: (payload: GscReportingSectionResult) => void;
  /** Resume: skip outline generation and reuse prior section markdown. */
  priorSectionResults?: GscReportingSectionResult[];
  savedOutline?: GscReportingOutlineResult;
  savedOutlineRequestBodyJson?: string;
};

export type GscReportingPipelineResult = {
  markdown: string;
  outline: GscReportingOutlineResult;
  truncatedInput: boolean;
  filenames: string[];
  sectionResults: GscReportingSectionResult[];
  /** Exact POST body JSON for the outline step (OpenRouter). */
  outlineRequestBodyJson: string;
};

export type { GscManualAiCluster };
