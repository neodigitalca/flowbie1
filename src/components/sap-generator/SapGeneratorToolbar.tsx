import { Loader2, Trash2, Upload, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GeneratorToolbarFrame } from "@/components/blog-generator/GeneratorToolbarFrame";
import { GeneratorToolbarOptionsFlyout } from "@/components/blog-generator/GeneratorToolbarOptionsFlyout";
import {
  GENERATOR_EXPORT_BTN,
  GENERATOR_FIELD_KEYWORD,
  GENERATOR_FIELD_URL,
  GENERATOR_NESTED_LABEL,
  GENERATOR_NESTED_NUM_INPUT,
  GENERATOR_NESTED_SHELL,
  GENERATOR_SELECT,
} from "@/components/blog-generator/generator-toolbar-theme";
import {
  BULK_HEADER_RUN_BTN,
  BULK_HEADER_TOOL_BTN,
  BULK_HEADER_UPLOAD_READY_BTN,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import {
  entityTypeShortLabel,
  entityTypesForLevel,
  type EntityGeographicLevel,
} from "@/lib/entity-geographic-level";
import {
  normalizeEntityCountInputChange,
  stepEntityCountInput,
} from "@/lib/local-analysis/entity-ad-group-budget";
import { cn } from "@/lib/utils";

function EntityToolbarCountField({
  label,
  inputId,
  value,
  disabled,
  ariaLabel,
  onChange,
}: {
  label: string;
  inputId: string;
  value: string;
  disabled?: boolean;
  ariaLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={GENERATOR_NESTED_SHELL}>
      <label htmlFor={inputId} className={GENERATOR_NESTED_LABEL}>
        {label}
      </label>
      <input
        id={inputId}
        type="number"
        min={1}
        step={1}
        autoComplete="off"
        value={value}
        disabled={disabled}
        className={GENERATOR_NESTED_NUM_INPUT}
        aria-label={ariaLabel}
        onChange={(e) => onChange(normalizeEntityCountInputChange(e.target.value))}
        onKeyDown={(e) => {
          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
          e.preventDefault();
          onChange(stepEntityCountInput(value, e.key === "ArrowUp" ? 1 : -1));
        }}
      />
    </div>
  );
}

export type SapGeneratorToolbarProps = {
  workspaceBusy: boolean;
  csvParsing: boolean;
  uploadLabel: string;
  entityAdGroupCountInput: string;
  onEntityAdGroupCountInputChange: (v: string) => void;
  entityAdsPerGroupInput: string;
  onEntityAdsPerGroupInputChange: (v: string) => void;
  suggestFocusKeyword: string;
  onSuggestFocusKeywordChange: (v: string) => void;
  suggestFocusLocation: string;
  onSuggestFocusLocationChange: (v: string) => void;
  runLoading: boolean;
  onPickFile: (file: File | null) => void;
  onRunClusters: () => void;
  onClear: () => void;
  entityGeographicLevel: EntityGeographicLevel;
  entityTypeFocus: string[];
  onEntityTypeFocusChange: (focus: string[]) => void;
  hasSapRowsForCsv: boolean;
  onDownloadTargetsCsv: () => void;
  showTempUrl?: boolean;
  tempSeedUrl?: string;
  onTempSeedUrlChange?: (v: string) => void;
};

export function SapGeneratorToolbar({
  workspaceBusy,
  csvParsing,
  uploadLabel,
  entityAdGroupCountInput,
  onEntityAdGroupCountInputChange,
  entityAdsPerGroupInput,
  onEntityAdsPerGroupInputChange,
  suggestFocusKeyword,
  onSuggestFocusKeywordChange,
  suggestFocusLocation,
  onSuggestFocusLocationChange,
  runLoading,
  onPickFile,
  onRunClusters,
  onClear,
  entityGeographicLevel,
  entityTypeFocus,
  onEntityTypeFocusChange,
  hasSapRowsForCsv,
  onDownloadTargetsCsv,
  showTempUrl = false,
  tempSeedUrl = "",
  onTempSeedUrlChange,
}: SapGeneratorToolbarProps) {
  const focusSelectValue =
    entityTypeFocus.find((t) => entityTypesForLevel(entityGeographicLevel).includes(t)) ?? "__none__";

  return (
    <GeneratorToolbarFrame
      primary={
        <>
          <input
            id="sap-grid-csv-upload"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              onPickFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          {showTempUrl && onTempSeedUrlChange ? (
            <Input
              type="url"
              className={GENERATOR_FIELD_URL}
              placeholder="https://example.com"
              value={tempSeedUrl}
              onChange={(e) => onTempSeedUrlChange(e.target.value)}
              disabled={workspaceBusy}
              aria-label="Website URL"
            />
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              uploadLabel.trim() ? BULK_HEADER_UPLOAD_READY_BTN : BULK_HEADER_TOOL_BTN,
            )}
            disabled={csvParsing}
            onClick={() => document.getElementById("sap-grid-csv-upload")?.click()}
          >
            {csvParsing ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-4 w-4 shrink-0" aria-hidden />
            )}
            Grid
          </Button>
          <Input
            type="text"
            placeholder="Keyword"
            value={suggestFocusKeyword}
            onChange={(e) => onSuggestFocusKeywordChange(e.target.value)}
            className={GENERATOR_FIELD_KEYWORD}
            disabled={runLoading}
            autoComplete="off"
            aria-label="Keyword"
          />
          <Input
            type="text"
            placeholder="Location"
            value={suggestFocusLocation}
            onChange={(e) => onSuggestFocusLocationChange(e.target.value)}
            className={GENERATOR_FIELD_KEYWORD}
            disabled={runLoading}
            autoComplete="off"
            aria-label="Location"
          />
          <GeneratorToolbarOptionsFlyout disabled={workspaceBusy} label="Budget">
            <div className="space-y-3">
              <EntityToolbarCountField
                label="Ad groups"
                inputId="sap-toolbar-ad-groups"
                value={entityAdGroupCountInput}
                disabled={runLoading}
                ariaLabel="Ad groups"
                onChange={onEntityAdGroupCountInputChange}
              />
              <EntityToolbarCountField
                label="Ads"
                inputId="sap-toolbar-ads"
                value={entityAdsPerGroupInput}
                disabled={runLoading}
                ariaLabel="Ads per ad group"
                onChange={onEntityAdsPerGroupInputChange}
              />
            </div>
          </GeneratorToolbarOptionsFlyout>
        </>
      }
      options={
        <Select
          value={focusSelectValue}
          onValueChange={(v) => {
            if (v === "__none__") {
              onEntityTypeFocusChange([]);
              return;
            }
            onEntityTypeFocusChange([v]);
          }}
        >
          <SelectTrigger className={GENERATOR_SELECT} aria-label="Entity type focus">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-[min(24rem,70vh)]">
            <SelectItem className="text-base" value="__none__">
              None
            </SelectItem>
            {entityTypesForLevel(entityGeographicLevel).map((label) => (
              <SelectItem key={label} className="text-base" value={label}>
                {entityTypeShortLabel(entityGeographicLevel, label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      actions={
        <>
          <Button
            type="button"
            size="sm"
            className={BULK_HEADER_RUN_BTN}
            disabled={workspaceBusy}
            aria-label="Run clusters"
            title="Run clusters"
            onClick={() => void onRunClusters()}
          >
            {runLoading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Wand2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            )}
            Clusters
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={GENERATOR_EXPORT_BTN}
            disabled={!hasSapRowsForCsv || workspaceBusy}
            aria-label="Download bulk CSV"
            title="Download bulk CSV (bulk-auto-generate-template columns)"
            onClick={onDownloadTargetsCsv}
          >
            Bulk CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 shrink-0 border border-red-600/70 bg-black p-0 text-red-500 hover:bg-red-950/50 hover:text-red-400"
            disabled={workspaceBusy}
            aria-label="Clear"
            title="Clear"
            onClick={onClear}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </>
      }
    />
  );
}
