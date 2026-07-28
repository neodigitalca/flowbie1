/**
 * Entity Orchestrator - WordPress origin fields → OpenRouter (AI) → Wikipedia category/list only.
 * No Google search.
 */

import { loadApiKey } from '@/lib/api';
import { readPreviousEntities } from './read-previous';
import { fetchOriginOnlyAcfContextForServiceAreas, getOriginOnlyListFromAcfContext } from './read-existing-origins-api';
import { filterDuplicatesWithAI } from './ai-dedupe-filter';
import { runOriginsToWikiFlow } from './origins-to-wiki-flow';
import type { ServiceAreaOrigin } from './radius-filter';
import { fetchScheduledPostTitles, checkConflicts } from '@/components/integrations/entity-generation/filtering/conflictChecker';
import { filterEntitiesNotInSitemap, filterAndSortByCriteria } from '@/components/integrations/entity-generation/filtering/entityFilter';
import { validateEntityByCriteria } from '@/components/integrations/entity-generation/validation/criteriaValidator';
import { analyzeTitleFormat } from '@/components/integrations/entity-generation/generation/urlLocationExtractor';
import type { WordPressSite } from '@/components/integrations/types';
import type { EntityWithCriteria, GenerationOptions } from '@/components/integrations/entity-generation/types';

export interface OrchestratorResult {
  entities: EntityWithCriteria[];
  suggestedTitleFormat: string;
  /** Present when radius filter ran during the Wikipedia step. */
  serviceAreaOrigin?: ServiceAreaOrigin;
}

/**
 * Run entity generation: WordPress origins → AI picks Wikipedia source → fetch category/list → filter. No Google.
 */
export async function runEntityOrchestrator(
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
  const openRouterApiKey = loadApiKey();
    if (!openRouterApiKey) {
    throw new Error('OpenRouter API key is required. Please set it in Settings.');
  }

  onProgress?.('Reading previous entities from sitemap...');
  let readResult;
  try {
    readResult = await readPreviousEntities(site, entitySitemapUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('HTML instead of XML') || msg.includes('Invalid sitemap')) {
      throw err;
    }
    throw new Error(`Failed to read sitemap: ${msg}`);
  }

  const { primaryCity: primaryCityFromSitemap, urls, existingEntities: sitemapDerivedOrigins } = readResult;
  let existingEntities: string[] = [];

  let existingAcfContext: Awaited<ReturnType<typeof fetchOriginOnlyAcfContextForServiceAreas>> = [];
  if (entitySitemapUrl?.trim()) {
    existingAcfContext = await fetchOriginOnlyAcfContextForServiceAreas(
      site,
      entitySitemapUrl,
      onProgress
    );
    if (existingAcfContext.length > 0) {
      existingEntities = getOriginOnlyListFromAcfContext(existingAcfContext);
    }
  }

  // Fall back to locations parsed from service-area sitemap URLs when ACF has no origin fields.
  if (existingEntities.length === 0 && sitemapDerivedOrigins?.length) {
    existingEntities = [...sitemapDerivedOrigins];
  }
  if (existingEntities.length === 0 && primaryCityFromSitemap) {
    existingEntities = [primaryCityFromSitemap];
  }

  const hasLocationHint =
    (lockedWikipediaSources != null && lockedWikipediaSources.length > 0) ||
    lockedWikipediaSource != null ||
    Boolean(promptModifier?.trim()) ||
    Boolean(keyword?.trim());

  if (existingEntities.length === 0 && !hasLocationHint) {
    throw new Error(
      'No origin/location data found for this site. Add locations to WordPress service-area or origin ACF fields, or select a Wikipedia category, or add a prompt modifier / keyword (e.g. city or region), then try again.'
    );
  }
  if (urls.length === 0) {
    throw new Error('No URLs found in sitemap');
  }
  let validated: EntityWithCriteria[] = [];

  // --- Wiki path: AI picks one Wikipedia source from existing entities (modifier optional) → one fetch ---
  const wikiResult = await runOriginsToWikiFlow({
    site,
    existingEntities,
    urls,
    count,
    promptModifier,
    keyword,
    lockedWikipediaSource,
    lockedWikipediaSources,
    apiKey: openRouterApiKey,
    onProgress,
    entitySitemapUrl,
    existingAcfContext,
    radiusPreset,
    primaryLocationLabelOverride,
  });
  if (wikiResult.entities.length >= count) {
    return {
      entities: wikiResult.entities.slice(0, count),
      suggestedTitleFormat: wikiResult.suggestedTitleFormat,
      serviceAreaOrigin: wikiResult.serviceAreaOrigin,
    };
  }
  validated = wikiResult.entities;

  const seen = new Set<string>();
  validated = validated.filter((e) => {
    const k = e.entity.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (validated.length === 0) {
    const originCount = existingEntities.length;
    const triedList = wikiResult.triedSources?.length
      ? ` Tried Wikipedia sources: ${wikiResult.triedSources.join(', ')}.`
      : '';
    throw new Error(
      `No entities found from Wikipedia for ${originCount} origin field${originCount !== 1 ? 's' : ''} (origins: ${existingEntities.slice(0, 5).join(', ')}). All candidates were filtered out or already exist in the sitemap.${triedList} Ensure your origin fields contain geographic locations (cities, neighborhoods, streets, etc.).`
    );
  }

  onProgress?.('Checking for duplicates with AI (validate before adding)...');
  const beforeDedupe = [...validated];
  const candidateNames = validated.map((e) => e.entity);
  const scheduledTitles = await fetchScheduledPostTitles(site);
  const afterAi = await filterDuplicatesWithAI(
    candidateNames,
    existingEntities,
    openRouterApiKey,
    onProgress,
    scheduledTitles,
    existingAcfContext.length > 0 ? existingAcfContext : undefined
  );
  const allowedSet = new Set(afterAi.map((n) => n.toLowerCase()));
  validated = validated.filter((e) => allowedSet.has(e.entity.toLowerCase()));
  // If AI dedupe left fewer than requested but we had enough before, fill back up to count
  if (validated.length < count && beforeDedupe.length >= count) {
    const validatedSet = new Set(validated.map((e) => e.entity.toLowerCase()));
    for (const e of beforeDedupe) {
      if (validated.length >= count) break;
      if (!validatedSet.has(e.entity.toLowerCase())) {
        validated.push(e);
        validatedSet.add(e.entity.toLowerCase());
      }
    }
  }

  if (promptModifier?.trim()) {
    onProgress?.(`Validating against criteria: "${promptModifier}"...`);
    const withCriteria: EntityWithCriteria[] = [];
    for (const e of validated) {
      try {
        const result = await validateEntityByCriteria(e.entity, promptModifier, openRouterApiKey);
        const criteriaData = {
          matches: result.matches,
          confidence: result.confidence,
          extractedData: result.extractedData ?? {},
          rankingValue: result.rankingValue,
        };
        onCriteriaInfo?.(e.entity, criteriaData);
        if (result.matches === true) {
          withCriteria.push({ ...e, criteriaData });
        }
      } catch {
        // skip
      }
    }
    validated = filterAndSortByCriteria(withCriteria, promptModifier, count);
  } else {
    validated = validated.slice(0, count);
  }

  const suggestedTitleFormat = analyzeTitleFormat(urls, existingEntities, site.name);
  return {
    entities: validated,
    suggestedTitleFormat,
    serviceAreaOrigin: wikiResult.serviceAreaOrigin,
  };
}
