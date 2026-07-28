/**
 * Entity module - agentic wiki research
 * Public API: generateEntities(options, onProgress?, onCriteriaInfo?).
 * Count is user input: return up to count entities; min 1 when possible.
 */

import { runEntityOrchestrator, type OrchestratorResult } from './orchestrator';
import type { GenerationOptions, EntityWithCriteria } from '@/components/integrations/entity-generation/types';

export { readPreviousEntities } from './read-previous';
export type { ReadPreviousResult } from './read-previous';
export { fetchExistingOriginsFromServiceAreas, getEntityPostTitles } from './read-existing-origins-api';
export { filterDuplicatesWithAI } from './ai-dedupe-filter';
export { extractLocationsFromEntityTitles } from './extract-locations-from-entity-titles';
export {
  filterWikipediaLocationsBeforeCount,
  type WikipediaPoolItem,
} from './pre-count-dedupe-filter';
export { getEntityPoolFromWikipediaCategory } from './category-pool';
export type { CategoryPoolEntity } from './category-pool';
export { validateEntityModifierViaGoogle, validatePoolWithModifierViaGoogle } from './validate-modifier-google';
export type { ValidateModifierResult } from './validate-modifier-google';
export {
  generateDfsSearchQuery,
  fetchSerpOrganic,
  deriveEntitySearchKeywordFromSiteName,
  deriveEntitySearchKeywordFromSiteContent,
  deriveTitleFormatFromExistingTitles,
} from './query-google';
export type { SerpOrganicItem } from './query-google';
export { extractCandidates } from './extract-candidates';
export { wikiValidateCandidates } from './wiki-validate';
export { runEntityOrchestrator, type OrchestratorResult };
export { suggestWikipediaCategoriesForPrompt } from './suggest-wikipedia-categories';

/**
 * Generate entities (agentic wiki research): read previous → DFS query → SERP → extract → wiki-validate.
 * Count = user input; returns up to count entities; guarantees at least 1 when possible.
 */
export async function generateEntities(
  options: GenerationOptions,
  onProgress?: (message: string) => void,
  onCriteriaInfo?: (entity: string, criteriaData: EntityWithCriteria['criteriaData']) => void
): Promise<OrchestratorResult> {
  return runEntityOrchestrator(options, onProgress, onCriteriaInfo);
}
