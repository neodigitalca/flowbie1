import { loadApiKey } from "@/lib/api";
import { type WordPressSite } from "@/components/integrations/types";
import { effectiveHasEntityForContentOptimizer } from "@/lib/entity-endpoint-extractor";
import { cleanTitleForNonEntity } from "@/lib/content-optimization-helpers";
import { determineEntity } from "./optimization-helpers";

export async function extractAndCleanEntity(
  hasEntityOverride: boolean | undefined,
  existingTitle: string,
  url: string,
  primaryKeyword: string,
  pendingCleanedTitle: string | undefined,
  site: WordPressSite,
  postTypeEndpoint?: string | null,
): Promise<{ entity: string | "N/A"; cleanedTitle: string }> {
  let extractedEntity: string | "N/A" = "N/A";
  let finalTitle = existingTitle || primaryKeyword;

  const effectiveEntity = effectiveHasEntityForContentOptimizer(site, postTypeEndpoint ?? null, hasEntityOverride);
  if (effectiveEntity === false) {
    return { entity: "N/A", cleanedTitle: finalTitle };
  }

  try {
    const openRouterApiKey = loadApiKey();
    if (openRouterApiKey && openRouterApiKey.trim().length > 0) {
      const result = await determineEntity(effectiveEntity, existingTitle, url, openRouterApiKey, site);
      extractedEntity = result.entity;
    }
  } catch (error) {
    console.warn("[Optimize Content] Error during entity extraction:", error);
    extractedEntity = "N/A";
  }

  const titleToUse = pendingCleanedTitle || cleanTitleForNonEntity(finalTitle, extractedEntity);
  if (titleToUse !== finalTitle) {
    finalTitle = titleToUse;
  }

  return { entity: extractedEntity, cleanedTitle: finalTitle };
}

export async function updateBulkStateWithEntity(
  site: WordPressSite,
  url: string,
  _primaryKeyword: string,
  extractedEntity: string | "N/A",
  _finalTitle: string,
  setBulkOptimizationState: (prev: any) => any,
): Promise<void> {
  const batchKey = `${site.id}-batch`;
  setBulkOptimizationState((prev: any) => {
    const current = prev[batchKey];
    if (current && current.urls.includes(url)) {
      return {
        ...prev,
        [batchKey]: {
          ...current,
          urlEntities: { ...(current.urlEntities || {}), [url]: extractedEntity },
        },
      };
    }
    return prev;
  });
}
