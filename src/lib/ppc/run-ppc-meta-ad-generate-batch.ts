import type { WordPressSite } from "@/components/integrations/types";
import type { MetaGenerateConfig, MetaAdContextSource, MetaAdResearchSection, MetaAdColorPalette } from "@/lib/ppc/meta-ads-types";
import { runPpcMetaAdGenerate } from "@/lib/ppc/run-ppc-meta-ad-generate";
import type {
  MetaAdGeneratePartialUpdate,
  RunPpcMetaAdGenerateResult,
} from "@/lib/ppc/run-ppc-meta-ad-generate";
import type { MetaGenerateProgressState } from "@/lib/ppc/meta-ads-progress-types";

export type MetaAdGenerateJob = {
  rowId: string;
  config: MetaGenerateConfig;
  focusKeyword?: string;
  contextSource?: MetaAdContextSource;
  contextUrl?: string;
  landingPageUrl?: string;
  allowPeopleInImage?: boolean;
  imagePromptModifier?: string;
  fbInstagramContent?: string;
  typographyStyle?: import("@/lib/ppc/meta-ad-typography-styles").MetaAdTypographyStyle;
  colorPalette?: MetaAdColorPalette;
  visualToolPalette?: import("@/lib/ppc/meta-ads-types").MetaAdVisualToolPalette;
};

export type MetaAdGenerateJobResult =
  | { rowId: string; ok: true; result: RunPpcMetaAdGenerateResult; config: MetaGenerateConfig }
  | { rowId: string; ok: false; config: MetaGenerateConfig; errorMessage: string };

export async function runPpcMetaAdGenerateBatch(options: {
  site: WordPressSite;
  apiKey: string;
  model: string;
  teamName?: string | null;
  jobs: MetaAdGenerateJob[];
  onProgress: (progress: MetaGenerateProgressState) => void;
  onResearchSections?: (rowId: string, sections: MetaAdResearchSection[]) => void;
  onPartialUpdate?: (rowId: string, patch: MetaAdGeneratePartialUpdate) => void;
  signal?: AbortSignal;
}): Promise<MetaAdGenerateJobResult[]> {
  const { site, apiKey, model, teamName, jobs, onProgress, signal } = options;
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
        const result = await runPpcMetaAdGenerate({
          site,
          apiKey,
          model,
          config: job.config,
          focusKeyword: job.focusKeyword,
          contextSource: job.contextSource,
          contextUrl: job.contextUrl,
          landingPageUrl: job.landingPageUrl,
          allowPeopleInImage: job.allowPeopleInImage,
          imagePromptModifier: job.imagePromptModifier,
          fbInstagramContent: job.fbInstagramContent,
          typographyStyle: job.typographyStyle,
          colorPalette: job.colorPalette,
          visualToolPalette: job.visualToolPalette,
          teamName,
          onProgress,
          onResearchSections: options.onResearchSections
            ? (sections) => options.onResearchSections!(job.rowId, sections)
            : undefined,
          onPartialUpdate: options.onPartialUpdate
            ? (patch) => options.onPartialUpdate!(job.rowId, patch)
            : undefined,
          signal,
        });
        return {
          rowId: job.rowId,
          ok: true as const,
          result,
          config: job.config,
        };
      } catch (err) {
        return {
          rowId: job.rowId,
          ok: false as const,
          config: job.config,
          errorMessage: err instanceof Error ? err.message : "Meta ad generation failed",
        };
      }
    }),
  );
}
