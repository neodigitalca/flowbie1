import React from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DASHBOARD_SETTINGS_FIELD_CLASS } from "@/components/manager/dashboard/dashboard-panel-styles";

interface LLMSettingsTabContentProps {
  temperature: number;
  onTemperatureChange: (value: number) => void;
  maxTokens: number;
  onMaxTokensChange: (value: number) => void;
  topP: number;
  onTopPChange: (value: number) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
}

const numberInputClassName = `${DASHBOARD_SETTINGS_FIELD_CLASS} max-w-[180px] h-12 shadow-none focus-visible:ring-2 focus-visible:ring-white/35`;

const LLMParameterControls: React.FC<{
  temperature: number;
  onTemperatureChange: (value: number) => void;
  maxTokens: number;
  onMaxTokensChange: (value: number) => void;
  topP: number;
  onTopPChange: (value: number) => void;
}> = (props) => {
  const tempId = React.useId();
  const topPId = React.useId();
  const maxTokId = React.useId();

  const handleSliderChange = (setter: (v: number) => void) => (values: number[]) => {
    setter(values[0]);
  };

  const handleInputChange = (setter: (v: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      setter(value);
    }
  };

  const handleMaxTokensInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      props.onMaxTokensChange(value);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label htmlFor={tempId} className="text-base font-semibold text-white">
          Temperature
        </Label>
        <Slider
          min={0.0}
          max={2.0}
          step={0.01}
          value={[props.temperature]}
          onValueChange={handleSliderChange(props.onTemperatureChange)}
          className="w-full"
        />
        <Input
          id={tempId}
          type="number"
          step="0.01"
          min="0.0"
          max="2.0"
          value={String(props.temperature)}
          onChange={handleInputChange(props.onTemperatureChange)}
          className={numberInputClassName}
        />
      </div>

      <div className="space-y-3">
        <Label htmlFor={topPId} className="text-base font-semibold text-white">
          Top P
        </Label>
        <Slider
          min={0.0}
          max={1.0}
          step={0.01}
          value={[props.topP]}
          onValueChange={handleSliderChange(props.onTopPChange)}
          className="w-full"
        />
        <Input
          id={topPId}
          type="number"
          step="0.01"
          min="0.0"
          max="1.0"
          value={String(props.topP)}
          onChange={handleInputChange(props.onTopPChange)}
          className={numberInputClassName}
        />
      </div>

      <div className="space-y-3">
        <Label htmlFor={maxTokId} className="text-base font-semibold text-white">
          Max tokens
        </Label>
        <Input
          id={maxTokId}
          type="number"
          step="1"
          min="1"
          value={String(props.maxTokens)}
          onChange={handleMaxTokensInputChange}
          className={numberInputClassName}
        />
      </div>
    </div>
  );
};

export const LLMSettingsTabContent: React.FC<LLMSettingsTabContentProps> = ({
  temperature,
  onTemperatureChange,
  maxTokens,
  onMaxTokensChange,
  topP,
  onTopPChange,
  selectedModel,
  onModelChange,
}) => {
  const modelSelectId = React.useId();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor={modelSelectId} className="text-base font-semibold text-white">
          Model
        </Label>
        <Select value={selectedModel} onValueChange={onModelChange}>
          <SelectTrigger
            id={modelSelectId}
            className={`${DASHBOARD_SETTINGS_FIELD_CLASS} h-12 w-full shadow-none md:max-w-md`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-white/[0.08] bg-zinc-900 text-base text-white">
            <SelectItem value="google/gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</SelectItem>
            <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
            <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
            <SelectItem value="openai/gpt-5-mini">GPT-5 Mini</SelectItem>
            <SelectItem value="openai/gpt-5">GPT-5</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <LLMParameterControls
        temperature={temperature}
        onTemperatureChange={onTemperatureChange}
        maxTokens={maxTokens}
        onMaxTokensChange={onMaxTokensChange}
        topP={topP}
        onTopPChange={onTopPChange}
      />
    </div>
  );
};
