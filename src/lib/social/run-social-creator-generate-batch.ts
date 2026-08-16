import type { WordPressSite } from "@/components/integrations/types";
import type { SocialGenerateConfig, MetaAdContextSource, MetaAdResearchSection, MetaAdColorPalette } from "@/lib/social/social-creator-types";
import { runSocialCreatorGenerate } from "@/lib/social/run-social-creator-generate";
import type {
  MetaAdGeneratePartialUpdate,
  RunSocialCreatorGenerateResult,
} from "@/lib/social/run-social-creator-generate";
import type { SocialGenerateProgressState } from "@/lib/social/social-creator-progress-types";

export type MetaAdGenerateJob = {
  rowId: string;
  config: SocialGenerateConfig;
  focusKeyword?: string;
  contextSource?: MetaAdContextSource;
  contextUrl?: string;
  landingPageUrl?: string;
  allowPeopleInImage?: boolean;
  imagePromptModifier?: string;
  fbInstagramContent?: string;
  typographyStyle?: import("@/lib/ppc/meta-ad-typography-styles").MetaAdTypographyStyle;
  colorPalette?: MetaAdColorPalette;
  visualToolPalette?: import("@/lib/social/social-creator-types").MetaAdVisualToolPalette;
};

export type MetaAdGenerateJobResult =
  | { rowId: string; ok: true; result: RunSocialCreatorGenerateResult; config: SocialGenerateConfig }
  | { rowId: string; ok: false; config: SocialGenerateConfig; errorMessage: string };

export async function runSocialCreatorGenerateBatch(options: {
  site: WordPressSite;
  apiKey: string;
  model: string;
  teamName?: string | null;
  jobs: MetaAdGenerateJob[];
  onProgress: (progress: SocialGenerateProgressState) => void;
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
        const result = await runSocialCreatorGenerate({
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
          errorMessage: err instanceof Error ? err.message : "Social post generation failed",
        };
      }
    }),
  );
}
