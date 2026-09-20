import type { WordPressSite } from "@/components/integrations/types";
import { applyElementorOptimization } from "@/lib/elementor-api";
import { hydrateElementorRow } from "@/lib/elementor-page-content/hydrate-elementor-row";
import { runElementorPageOptimizeFromResearch } from "@/lib/elementor-page-content/run-elementor-page-optimize";
import { updateOptimizationProgress } from "@/hooks/content-optimization/optimization-helpers";
import type { ContentPrepHarnessSetters } from "@/lib/overview/overview-content-prep-harness-run";
import { markContentPrepHarnessSection } from "@/lib/overview/overview-content-prep-harness-run";
import { contentOptimizeHarnessSectionIndex } from "@/lib/overview/overview-content-optimize-pipeline";

export type ContinueElementorPageOptimizeArgs = {
  site: WordPressSite;
  siteId: string;
  url: string;
  focusKeyword: string;
  pageTitle?: string;
  seoResearchRaw: string;
  internalLinkHints?: string;
  setOptimizationProgress: (prev: unknown) => unknown;
  contentPrepHarnessSetters: ContentPrepHarnessSetters | null;
  flushGeneratedFiles: () => void;
};

export async function runContinueOptimizationElementorPage(
  args: ContinueElementorPageOptimizeArgs,
): Promise<void> {
  const {
    site,
    siteId,
    url,
    focusKeyword,
    pageTitle,
    seoResearchRaw,
    internalLinkHints,
    setOptimizationProgress,
    contentPrepHarnessSetters,
    flushGeneratedFiles,
  } = args;

  updateOptimizationProgress(
    setOptimizationProgress,
    siteId,
    "plan",
    0.68,
    "Reading Elementor page design…",
  );

  const hydrated = await hydrateElementorRow(site, url, { siteId: site.id });
  const elementorJson = hydrated.patch.elementorDataJson?.trim();
  if (!elementorJson) {
    throw new Error("Elementor page data is missing for this URL.");
  }

  if (contentPrepHarnessSetters) {
    markContentPrepHarnessSection(
      url,
      contentOptimizeHarnessSectionIndex("Checklist"),
      "done",
      contentPrepHarnessSetters,
    );
    flushGeneratedFiles();
  }

  updateOptimizationProgress(
    setOptimizationProgress,
    siteId,
    "write",
    0.75,
    "Optimizing Elementor section body copy (headings unchanged)…",
  );

  const optimized = await runElementorPageOptimizeFromResearch({
    site,
    elementorJson,
    designBreakdown: hydrated.patch.elementorDesignBreakdown,
    seoResearchBrief: seoResearchRaw,
    focusKeyword,
    pageTitle,
    pageUrl: url,
    onProgress: (message) =>
      updateOptimizationProgress(setOptimizationProgress, siteId, "write", 0.85, message),
  });

  await applyElementorOptimization(
    site,
    hydrated.postId,
    JSON.stringify(optimized.modifiedElementorData),
  );

  if (contentPrepHarnessSetters) {
    markContentPrepHarnessSection(
      url,
      contentOptimizeHarnessSectionIndex("Post content"),
      "done",
      contentPrepHarnessSetters,
    );
    flushGeneratedFiles();
  }

  updateOptimizationProgress(
    setOptimizationProgress,
    siteId,
    "done",
    1,
    optimized.summary || "Elementor page optimized.",
  );
}
