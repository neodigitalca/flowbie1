import type { WordPressSite } from "@/components/integrations/types";
import type { PpcWpPageContext } from "@/lib/ppc/google-ads-types";
import {
  runContentCreatorGenerate,
  type RunContentCreatorGenerateResult,
} from "@/lib/social/run-content-creator-generate";
import type { ContentCalendarRow, ContentCreatorGenerateConfig } from "@/lib/social/content-creator-types";
import type { ContentGenerateProgressState } from "@/lib/social/content-creator-progress-types";
import type { ContentResearchSection } from "@/lib/social/content-creator-types";

export type ContentCreatorGenerateJob = {
  rowId: string;
  sourceRow: ContentCalendarRow;
  config: ContentCreatorGenerateConfig;
};

export type ContentCreatorGenerateJobResult =
  | { rowId: string; ok: true; result: RunContentCreatorGenerateResult; config: ContentCreatorGenerateConfig }
  | { rowId: string; ok: false; config: ContentCreatorGenerateConfig; errorMessage: string };

export async function runContentCreatorGenerateBatch(options: {
  site: WordPressSite;
  apiKey: string;
  model: string;
  landingPages: PpcWpPageContext[];
  jobs: ContentCreatorGenerateJob[];
  onProgress: (progress: ContentGenerateProgressState) => void;
  onResearchSections?: (rowId: string, sections: ContentResearchSection[]) => void;
  onPartialUpdate?: (rowId: string, patch: Partial<ContentCalendarRow>) => void;
  signal?: AbortSignal;
}): Promise<ContentCreatorGenerateJobResult[]> {
  const { site, apiKey, model, landingPages, jobs, onProgress, signal } = options;
  if (jobs.length === 0) return [];

  return Promise.all(
    jobs.map(async (job) => {
      if (signal?.aborted) {
        return {
          rowId: job.rowId,
          ok: false as const,
          config: job.config,
          errorMessage: "Generation cancelled",
        };
      }

      try {
        const result = await runContentCreatorGenerate({
          site,
          apiKey,
          model,
          config: job.config,
          sourceRow: job.sourceRow,
          landingPages,
          onProgress,
          onResearchSections: (sections) => options.onResearchSections?.(job.rowId, sections),
          onPartialUpdate: (patch) => options.onPartialUpdate?.(job.rowId, patch),
          signal,
        });
        return { rowId: job.rowId, ok: true as const, result, config: job.config };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Content generation failed";
        return { rowId: job.rowId, ok: false as const, config: job.config, errorMessage };
      }
    }),
  );
}
