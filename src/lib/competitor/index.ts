export { runCompetitorOrchestrator } from "@/lib/competitor/orchestrator";
export type {
  CompetitorGenerationOptions,
  CompetitorOrchestratorResult,
  CompetitorProgressCallback,
  CompetitorWithRow,
  ConnectedSiteProfile,
} from "@/lib/competitor/types";
export { fetchExternalSitemap } from "@/lib/competitor/fetch-external-sitemap";

import { runCompetitorOrchestrator } from "@/lib/competitor/orchestrator";
import type {
  CompetitorGenerationOptions,
  CompetitorOrchestratorResult,
  CompetitorProgressCallback,
} from "@/lib/competitor/types";

export async function generateCompetitors(
  options: CompetitorGenerationOptions,
  onProgress?: CompetitorProgressCallback,
): Promise<CompetitorOrchestratorResult> {
  return runCompetitorOrchestrator(options, onProgress);
}
