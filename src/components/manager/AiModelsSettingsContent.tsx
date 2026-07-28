import { Sparkles } from "lucide-react";
import { LLMSettingsTabContent } from "@/components/LLMSettingsTabContent";
import {
  DASHBOARD_SETTINGS_GROUP_CLASS,
  DASHBOARD_SETTINGS_PANEL_CLASS,
} from "@/components/manager/dashboard/dashboard-panel-styles";

export type AiModelsSettingsContentProps = {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  temperature: number;
  setTemperature: (value: number) => void;
  maxTokens: number;
  setMaxTokens: (value: number) => void;
  topP: number;
  setTopP: (value: number) => void;
};

export function AiModelsSettingsContent({
  selectedModel,
  setSelectedModel,
  temperature,
  setTemperature,
  maxTokens,
  setMaxTokens,
  topP,
  setTopP,
}: AiModelsSettingsContentProps) {
  return (
    <div className={`${DASHBOARD_SETTINGS_PANEL_CLASS} space-y-4 text-white`}>
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-white" aria-hidden />
        <h2 className="text-base font-semibold text-white">AI &amp; Models</h2>
      </div>

      <div className={DASHBOARD_SETTINGS_GROUP_CLASS}>
        <p className="font-semibold text-white">Generation defaults</p>
        <p className="text-base text-white">Default model and sampling for AI features across Flowbie.</p>
        <LLMSettingsTabContent
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          temperature={temperature}
          onTemperatureChange={setTemperature}
          maxTokens={maxTokens}
          onMaxTokensChange={setMaxTokens}
          topP={topP}
          onTopPChange={setTopP}
        />
      </div>
    </div>
  );
}
