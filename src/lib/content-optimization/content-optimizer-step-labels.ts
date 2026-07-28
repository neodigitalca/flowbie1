/** Canonical Content Optimizer pipeline step labels (Details drawer + full bulk panel). */
export const CONTENT_OPTIMIZER_STEP_LABELS = [
  { key: "fetch", label: "Fetch page", progress: 10 },
  { key: "gsc", label: "GSC data", progress: 25 },
  { key: "keyword-research", label: "Keyword research", progress: 40 },
  { key: "ai-analysis", label: "AI analysis", progress: 55 },
  { key: "blueprint", label: "Blueprint", progress: 70 },
  { key: "content", label: "Content generation", progress: 82 },
  { key: "faq", label: "FAQ schema", progress: 90 },
  { key: "upload", label: "Upload", progress: 95 },
  { key: "complete", label: "Complete", progress: 100 },
] as const;

export function resolveContentOptimizerStepLabel(step: string): string {
  const stepLower = step.toLowerCase();
  if (stepLower.includes("using inventory")) {
    return "Using inventory";
  }
  if (stepLower.includes("reading acf")) {
    return "Reading keywords";
  }
  if (stepLower.includes("loading sitemap") || stepLower.includes("loading site")) {
    return "Loading sitemap";
  }
  if (stepLower.includes("preparing batch")) {
    return "Preparing batch";
  }
  if (stepLower.includes("seo research") || stepLower.includes("starting optimization")) {
    return "SEO research";
  }
  if (stepLower.includes("fetch") || stepLower.includes("resolving")) {
    return "Fetch page";
  }
  if (stepLower.includes("gsc") || stepLower.includes("performance")) {
    return "GSC data";
  }
  if (stepLower.includes("keyword") || stepLower.includes("analyzing keyword")) {
    return "Keyword research";
  }
  if (stepLower.includes("ai") || stepLower.includes("analysis")) {
    return "AI analysis";
  }
  if (stepLower.includes("blueprint") || stepLower.includes("checklist")) {
    return "Blueprint";
  }
  if (stepLower.includes("generating extra text")) {
    return "Writing extra text (H2 → H3)";
  }
  if (stepLower.includes("generating meta")) {
    return "Writing meta (description · title · FAQ)";
  }
  if (stepLower.includes("researching")) {
    return "Research APIs";
  }
  if (stepLower.includes("ensuring links")) {
    return "Adding internal links";
  }
  if (stepLower.includes("content") || stepLower.includes("generating")) {
    return "Content generation";
  }
  if (stepLower.includes("faq") || stepLower.includes("schema")) {
    return "FAQ schema";
  }
  if (stepLower.includes("upload") || stepLower.includes("updating acf") || stepLower.includes("updating post") || stepLower.includes("writing to wordpress") || stepLower.includes("uploading to wordpress")) {
    return "Upload";
  }
  if (stepLower.includes("complete")) {
    return "Complete";
  }
  return step;
}

export function contentOptimizerStepProgress(step: string): number {
  const stepLower = step.toLowerCase();
  if (stepLower.includes("loading sitemap") || stepLower.includes("preparing batch")) return 5;
  if (stepLower.includes("using inventory") || stepLower.includes("reading acf")) return 8;
  if (stepLower.includes("fetch") || stepLower.includes("resolving")) return 10;
  if (stepLower.includes("gsc") || stepLower.includes("performance")) return 25;
  if (stepLower.includes("keyword") || stepLower.includes("research")) return 40;
  if (stepLower.includes("ai") || stepLower.includes("analysis")) return 55;
  if (stepLower.includes("blueprint") || stepLower.includes("checklist")) return 70;
  if (stepLower.includes("content") || stepLower.includes("generating")) return 82;
  if (stepLower.includes("faq") || stepLower.includes("schema")) return 90;
  if (stepLower.includes("upload") || stepLower.includes("updating acf") || stepLower.includes("updating post") || stepLower.includes("writing to wordpress")) return 95;
  if (stepLower.includes("complete")) return 100;
  return 0;
}

export function contentOptimizerStepIndex(step: string): number {
  const stepLower = step.toLowerCase();
  if (stepLower.includes("fetch") || stepLower.includes("resolving")) return 0;
  if (stepLower.includes("gsc") || stepLower.includes("performance")) return 1;
  if (stepLower.includes("keyword") || stepLower.includes("research")) return 2;
  if (stepLower.includes("ai") || stepLower.includes("analysis")) return 3;
  if (stepLower.includes("blueprint") || stepLower.includes("checklist")) return 4;
  if (stepLower.includes("content") || stepLower.includes("generating")) return 5;
  if (stepLower.includes("faq") || stepLower.includes("schema")) return 6;
  if (stepLower.includes("upload") || stepLower.includes("updating acf") || stepLower.includes("updating post") || stepLower.includes("writing to wordpress")) return 7;
  if (stepLower.includes("complete")) return 8;
  return -1;
}

/** True when bulk runner can start the next SERP-warmed URL (upload does not block generation). */
export function isBulkUploadPhaseStep(step: string): boolean {
  const stepLower = step.toLowerCase();
  return (
    stepLower.includes("upload") ||
    stepLower.includes("updating post") ||
    stepLower.includes("updating acf") ||
    stepLower.includes("writing to wordpress") ||
    stepLower.includes("creating draft") ||
    stepLower.includes("creating faq") ||
    stepLower.includes("uploading extra image") ||
    stepLower.includes("updating seo extra text")
  );
}
