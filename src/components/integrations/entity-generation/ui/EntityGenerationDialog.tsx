/**
 * Entity Generation Dialog Component
 * Main dialog for entity generation
 */

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Sparkles, Loader2 } from "lucide-react";
import type { WordPressSite } from "../../types";
import type { CriteriaData, RadiusDistancePreset } from "../types";
import type { EntityGenerationProgress } from "../hooks/useEntityGeneration";
import type { WikipediaSource } from "@/lib/entity/decide-wikipedia-source-ai";
import type { ServiceAreaOrigin } from "@/lib/entity/radius-filter";
import { EntityGenerationPanel } from "./EntityGenerationPanel";

interface EntityGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  onGenerate: () => void;
  onOpenCsvDialog: () => void;
  isGenerating: boolean;
  entityGenerationProgress: EntityGenerationProgress | undefined;
  entityRadiusPreset: RadiusDistancePreset;
  onEntityRadiusPresetChange: (v: RadiusDistancePreset) => void;
  serviceAreaOrigin?: ServiceAreaOrigin;
  setDistanceOriginLabel?: (label: string | null) => void;
}

export const EntityGenerationDialog: React.FC<EntityGenerationDialogProps> = ({
  open,
  onOpenChange,
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
  onGenerate,
  onOpenCsvDialog,
  isGenerating,
  entityGenerationProgress,
  entityRadiusPreset,
  onEntityRadiusPresetChange,
  serviceAreaOrigin,
  setDistanceOriginLabel,
}) => {
  const storageKey =
    pendingEntitySite && pendingEntitySitemap ? `${pendingEntitySite.id}-${pendingEntitySitemap}` : null;

  const hasGeneratedEntities = Boolean(storageKey && generatedEntities.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle>Generate Origins</DialogTitle>
          <DialogDescription className="text-base">
            {pendingEntitySite && pendingEntitySitemap && (
              <>
                Generate location origins for {pendingEntitySite.name} based on service-area sitemap analysis.
                <br />
                <span className="text-base text-muted-foreground">Service-area sitemap is set.</span>
                {hasGeneratedEntities && !isGenerating && (
                  <span className="block mt-2 text-green-600">{generatedEntities.length} origins generated!</span>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <EntityGenerationPanel
          pendingEntitySite={pendingEntitySite}
          pendingEntitySitemap={pendingEntitySitemap}
          generatedEntities={generatedEntities}
          wikipediaLinks={wikipediaLinks}
          criteriaInfo={criteriaInfo}
          generalCriteriaInfo={generalCriteriaInfo}
          selectedEntity={selectedEntity}
          onSelectEntity={onSelectEntity}
          entityCount={entityCount}
          entityPromptModifier={entityPromptModifier}
          entityKeyword={entityKeyword}
          onEntityCountChange={onEntityCountChange}
          onEntityPromptModifierChange={onEntityPromptModifierChange}
          onEntityKeywordChange={onEntityKeywordChange}
          selectedWikipediaSources={selectedWikipediaSources}
          onSelectedWikipediaSourcesChange={onSelectedWikipediaSourcesChange}
          wikiCategorySuggestions={wikiCategorySuggestions}
          wikiCategorySuggestionsLoading={wikiCategorySuggestionsLoading}
          isGenerating={isGenerating}
          entityGenerationProgress={entityGenerationProgress}
          entityRadiusPreset={entityRadiusPreset}
          onEntityRadiusPresetChange={onEntityRadiusPresetChange}
          serviceAreaOrigin={serviceAreaOrigin}
          setDistanceOriginLabel={setDistanceOriginLabel}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {hasGeneratedEntities ? "Close" : "Cancel"}
          </Button>
          {hasGeneratedEntities && (
            <Button variant="default" onClick={onOpenCsvDialog}>
              <Download className="h-4 w-4 mr-2" />
              Generate CSV Template
            </Button>
          )}
          {!hasGeneratedEntities && (
            <Button onClick={onGenerate} disabled={!entityCount || entityCount < 1 || isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Origins
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
