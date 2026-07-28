/**
 * Entity Generator Module
 * Thin wrapper: delegates to agentic entity flow (@/lib/entity).
 * Count is user input; returns up to count entities; min 1 when possible.
 */

import { notify, notifyHeaderError } from "@/lib/app-notifications";
import { generateEntities as generateEntitiesFromEntityModule } from '@/lib/entity';
import type { OrchestratorResult } from '@/lib/entity';
import type { EntityWithCriteria, GenerationOptions } from '../types';

/**
 * Main entity generation function (agentic wiki research).
 * Delegates to @/lib/entity; handles sitemap/parse errors with notify.
 */
export async function generateEntities(
  options: GenerationOptions,
  onProgress?: (message: string) => void,
  onCriteriaInfo?: (entity: string, criteriaData: EntityWithCriteria['criteriaData']) => void
): Promise<OrchestratorResult> {
  const {
    site,
    sitemapUrl,
    count,
    promptModifier,
    keyword,
    lockedWikipediaSource,
    lockedWikipediaSources,
    radiusPreset,
    primaryLocationLabelOverride,
  } = options;
  const entitySitemapUrl = site.entitySitemapUrl || sitemapUrl;

  try {
    return await generateEntitiesFromEntityModule(
      {
        site,
        sitemapUrl: entitySitemapUrl,
        count,
        promptModifier,
        keyword,
        lockedWikipediaSource,
        lockedWikipediaSources,
        radiusPreset,
        primaryLocationLabelOverride,
      },
      onProgress,
      onCriteriaInfo
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (
      errorMessage.includes('HTML instead of XML') ||
      errorMessage.includes('Invalid sitemap format') ||
      errorMessage.includes('does not appear to be a valid sitemap')
    ) {
      notifyHeaderError("Entity generation failed", errorMessage, { duration: 10000 });
    }
    if (
      errorMessage.includes('Attribute without value') ||
      errorMessage.includes('XML')
    ) {
      notifyHeaderError("Entity generation failed", errorMessage);
    }
    throw err;
  }
}
