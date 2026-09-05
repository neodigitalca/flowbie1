import type { WordPressSite } from "@/components/integrations/types";
import type { EntityPageCreatorExecutionPayload } from "@/lib/tasks-types";
import {
  DEFAULT_ENTITY_GEOGRAPHIC_LEVEL,
  ENTITY_TYPE_TAXONOMY,
} from "@/lib/entity-geographic-level";
import { buildLocalAnalysisClientAudienceMarkdown } from "@/lib/local-analysis-metro-context";
import { getPrimaryCityStateLabel } from "@/lib/primary-location-from-site";
import { hasMasterInstructions } from "@/lib/master-instructions-storage";

/** Grid / workflow entity picks: business areas first; avoid civic-building defaults that invite schools. */
export const DEFAULT_ENTITY_PAGE_CREATOR_ENTITY_TYPE_FOCUS: readonly string[] = [
  ENTITY_TYPE_TAXONOMY.city[1]!,
  ENTITY_TYPE_TAXONOMY.city[0]!,
  ENTITY_TYPE_TAXONOMY.city[6]!,
];

export type EntityPageCreatorClusterContext = {
  clientAudienceContextMarkdown: string;
  entityTypeFocus: readonly string[];
  businessName: string;
};

export function resolveEntityPageCreatorClusterContext(args: {
  site: WordPressSite;
  payload: EntityPageCreatorExecutionPayload;
  gridPlaceHints?: readonly string[];
  focusKeyword?: string;
}): EntityPageCreatorClusterContext {
  const { site, payload } = args;
  const businessName = (payload.businessName?.trim() || site.name?.trim() || "").trim();
  const focusKeyword = (args.focusKeyword?.trim() || payload.focusKeyword?.trim() || "").trim();
  const focusLocation =
    getPrimaryCityStateLabel(site)?.trim() ||
    args.gridPlaceHints?.find((h) => h.trim())?.trim() ||
    "";

  const fromPayload = (payload.entityTypeFocus ?? []).map((f) => f.trim()).filter(Boolean);
  const entityTypeFocus =
    fromPayload.length > 0 ? fromPayload : [...DEFAULT_ENTITY_PAGE_CREATOR_ENTITY_TYPE_FOCUS];

  const clientAudienceContextMarkdown = buildLocalAnalysisClientAudienceMarkdown({
    ...(businessName ? { businessName } : {}),
    siteName: site.name,
    siteUrl: site.siteUrl,
    ...(focusKeyword ? { focusKeyword } : {}),
    ...(focusLocation ? { focusLocation } : {}),
    entityGeographicLevel: DEFAULT_ENTITY_GEOGRAPHIC_LEVEL,
    entityTypeFocusLabels: [...entityTypeFocus],
    themeMixGovernedByMasterRules: hasMasterInstructions(site.id),
  }).trim();

  return { clientAudienceContextMarkdown, entityTypeFocus, businessName };
}
