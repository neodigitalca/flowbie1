import React from "react";
import type { CompetitorGridPlaceRow } from "@/lib/competitor-research/local-dominator-grid-parse";
import type { WordPressSite } from "@/components/integrations/types";
import type {
  CompetitorGenerationPhase,
  CompetitorGenerationProgress,
  CompetitorWorkspaceControls,
  GeneratedCompetitorRow,
} from "../types";
import { CompetitorDiscoverySection } from "./CompetitorDiscoverySection";
import { CompetitorGenerationMainSection } from "./CompetitorGenerationMainSection";

export type CompetitorGenerationPanelProps = {
  site: WordPressSite | null;
  workspace: CompetitorWorkspaceControls;
  workspaceBusy: boolean;
  gridPlaces: CompetitorGridPlaceRow[];
  gridCsvName: string | null;
  gridParseError: string | null;
  csvParsing: boolean;
  onPickGridCsv: (file: File | null) => void;
  competitorCount: number;
  onCompetitorCountChange: (n: number) => void;
  competitorKeyword: string;
  onCompetitorKeywordChange: (v: string) => void;
  promptModifier: string;
  onPromptModifierChange: (v: string) => void;
  gridKeywordFromCsv: string;
  isGenerating: boolean;
  progress: CompetitorGenerationProgress | null;
  generatedRows: GeneratedCompetitorRow[];
  phase?: CompetitorGenerationPhase;
  className?: string;
};

export function CompetitorGenerationPanel({
  site,
  workspace,
  workspaceBusy,
  gridPlaces,
  gridCsvName,
  gridParseError,
  csvParsing,
  onPickGridCsv,
  competitorCount,
  onCompetitorCountChange,
  competitorKeyword,
  onCompetitorKeywordChange,
  promptModifier,
  onPromptModifierChange,
  gridKeywordFromCsv,
  isGenerating,
  progress,
  generatedRows,
  phase = "full",
  className,
}: CompetitorGenerationPanelProps) {
  const showFind = phase === "find" || phase === "full";
  const showGenerate = phase === "generate" || phase === "full";

  return (
    <div className={className ?? "overflow-y-auto flex-1"}>
      {showFind ? (
        <CompetitorDiscoverySection
          site={site}
          workspace={workspace}
          workspaceBusy={workspaceBusy}
          gridPlaces={gridPlaces}
          gridCsvName={gridCsvName}
          gridParseError={gridParseError}
          csvParsing={csvParsing}
          onPickGridCsv={onPickGridCsv}
          competitorCount={competitorCount}
          onCompetitorCountChange={onCompetitorCountChange}
          competitorKeyword={competitorKeyword}
          onCompetitorKeywordChange={onCompetitorKeywordChange}
          promptModifier={promptModifier}
          onPromptModifierChange={onPromptModifierChange}
          gridKeywordFromCsv={gridKeywordFromCsv}
        />
      ) : null}
      {showGenerate ? (
        <CompetitorGenerationMainSection
          isGenerating={isGenerating}
          progress={progress}
          generatedRows={generatedRows}
        />
      ) : null}
    </div>
  );
}
