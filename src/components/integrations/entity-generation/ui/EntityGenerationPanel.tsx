/**
 * Shared scrollable body for origin generation (dialog + SAP generator page).
 */

import React from "react";
import type { WordPressSite } from "../../types";
import type { CriteriaData, RadiusDistancePreset } from "../types";
import type { EntityGenerationProgress } from "../hooks/useEntityGeneration";
import type { WikipediaSource } from "@/lib/entity/decide-wikipedia-source-ai";
import type { ServiceAreaOrigin } from "@/lib/entity/radius-filter";
import { EntityDistanceDiscoverySection } from "./EntityDistanceDiscoverySection";
import { EntityGenerationMainSection } from "./EntityGenerationMainSection";

export type EntityGenerationPhase = "find" | "generate" | "full";

export interface EntityGenerationPanelProps {
  pendingEntitySite: WordPressSite | null;
  pendingEntitySitemap: string | null;
  generatedEntities: string[];
  wikipediaLinks: Record<string, string>;
  criteriaInfo: Record<string, CriteriaData>;
  generalCriteriaInfo: string | undefined;
  selectedEntity: string | null;
  onSelectEntity: (entity: string | null) => void;
  entityCount: number;
  entityPromptModifier: string;
  entityKeyword: string;
  onEntityCountChange: (count: number) => void;
  onEntityPromptModifierChange: (modifier: string) => void;
  onEntityKeywordChange: (keyword: string) => void;
  selectedWikipediaSources: WikipediaSource[];
  onSelectedWikipediaSourcesChange: (sources: WikipediaSource[]) => void;
  wikiCategorySuggestions: WikipediaSource[];
  wikiCategorySuggestionsLoading: boolean;
  isGenerating: boolean;
  entityGenerationProgress: EntityGenerationProgress | undefined;
  entityRadiusPreset: RadiusDistancePreset;
  onEntityRadiusPresetChange: (v: RadiusDistancePreset) => void;
  serviceAreaOrigin?: ServiceAreaOrigin;
  setDistanceOriginLabel?: (label: string | null) => void;
  className?: string;
  /** `full` (default): stacked find + generate. SAP uses `find` / `generate` on separate tabs. */
  phase?: EntityGenerationPhase;
}

export const EntityGenerationPanel: React.FC<EntityGenerationPanelProps> = ({
  pendingEntitySite,
  pendingEntitySitemap,
  generatedEntities,
  wikipediaLinks,
  criteriaInfo,
  generalCriteriaInfo,
  selectedEntity,
  onSelectEntity,
  entityCount,
  entityPromptModifier,
  entityKeyword,
  onEntityCountChange,
  onEntityPromptModifierChange,
  onEntityKeywordChange,
  selectedWikipediaSources,
  onSelectedWikipediaSourcesChange,
  wikiCategorySuggestions,
  wikiCategorySuggestionsLoading,
  isGenerating,
  entityGenerationProgress,
  entityRadiusPreset,
  onEntityRadiusPresetChange,
  serviceAreaOrigin,
  setDistanceOriginLabel,
  className,
  phase = "full",
}) => {
  const showFind = phase === "find" || phase === "full";
  const showGenerate = phase === "generate" || phase === "full";

  const mainProps = {
    pendingEntitySite,
    pendingEntitySitemap,
    generatedEntities,
    wikipediaLinks,
    criteriaInfo,
    generalCriteriaInfo,
    selectedEntity,
    onSelectEntity,
    entityCount,
    entityPromptModifier,
    entityKeyword,
    onEntityCountChange,
    onEntityPromptModifierChange,
    onEntityKeywordChange,
    selectedWikipediaSources,
    onSelectedWikipediaSourcesChange,
    wikiCategorySuggestions,
    wikiCategorySuggestionsLoading,
    isGenerating,
    entityGenerationProgress,
    entityRadiusPreset,
    onEntityRadiusPresetChange,
  };

  return (
    <div className={className ?? "overflow-y-auto flex-1"}>
      {showFind ? (
        <EntityDistanceDiscoverySection
          pendingEntitySite={pendingEntitySite}
          pendingEntitySitemap={pendingEntitySitemap}
          serviceAreaOrigin={serviceAreaOrigin}
          setDistanceOriginLabel={setDistanceOriginLabel}
        />
      ) : null}
      {showGenerate ? <EntityGenerationMainSection {...mainProps} /> : null}
    </div>
  );
};
