import { Eraser, Loader2, Upload, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BULK_HEADER_FIELD,
  BULK_HEADER_RUN_BTN,
  BULK_HEADER_SELECT_TRIGGER,
  BULK_HEADER_TOOL_BTN,
  BULK_HEADER_UPLOAD_READY_BTN,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import {
  entityTypeShortLabel,
  entityTypesForLevel,
  widestEntityTypeShortLabel,
  type EntityGeographicLevel,
} from "@/lib/entity-geographic-level";
import {
  normalizeSapPageBudgetInputChange,
  stepSapPageBudgetInput,
} from "@/lib/sap-page-budget-input";
import { cn } from "@/lib/utils";

const LOCAL_EXPORT_BTN_CLASS =
  "h-8 min-h-8 shrink-0 border-0 bg-[hsl(var(--muted)/0.45)] px-2.5 text-base shadow-none transition-colors hover:bg-[hsl(var(--muted)/0.6)] disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-50";

export type SapGeneratorToolbarProps = {
  workspaceBusy: boolean;
  csvParsing: boolean;
  uploadLabel: string;
  sapPageBudgetInput: string;
  onSapPageBudgetInputChange: (v: string) => void;
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
  /** When set, arrow keys use this instead of the default min-1 step fallback. */
  sapPageBudgetArrowStep?: (current: string, direction: "up" | "down") => string | null;
  /** Override budget field normalization (e.g. competitor count with no min fallback). */
  sapPageBudgetNormalizeChange?: (raw: string) => string;
  /** Text input avoids browser number-field coercion for competitor count. */
  sapPageBudgetTextInput?: boolean;
  sapPageBudgetAriaLabel?: string;
  sapPageBudgetTitle?: string;
};

export function SapGeneratorToolbar({
  workspaceBusy,
  csvParsing,
  uploadLabel,
  sapPageBudgetInput,
  onSapPageBudgetInputChange,
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
  sapPageBudgetArrowStep,
  sapPageBudgetNormalizeChange = normalizeSapPageBudgetInputChange,
  sapPageBudgetTextInput = false,
  sapPageBudgetAriaLabel = "SAP page budget",
  sapPageBudgetTitle = "Total SAP pages for this run",
}: SapGeneratorToolbarProps) {
  const focusSelectValue =
    entityTypeFocus.find((t) => entityTypesForLevel(entityGeographicLevel).includes(t)) ?? "__none__";
  const widestEntityTypeLabel = widestEntityTypeShortLabel(entityGeographicLevel);
  const entityFocusMinWidth = `calc(${widestEntityTypeLabel.length}ch + 1.75rem)`;

  const runDisabled = workspaceBusy;

  return (
    <div className="flex min-w-0 flex-1 flex-nowrap items-center">
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
      <div className="grid shrink-0 auto-cols-max grid-flow-col items-center gap-2">
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
          type={sapPageBudgetTextInput ? "text" : "number"}
          inputMode={sapPageBudgetTextInput ? "numeric" : undefined}
          min={sapPageBudgetTextInput ? undefined : 1}
          step={sapPageBudgetTextInput ? undefined : 1}
          autoComplete="off"
          value={sapPageBudgetInput}
          onChange={(e) => {
            onSapPageBudgetInputChange(sapPageBudgetNormalizeChange(e.target.value));
          }}
          onKeyDown={(e) => {
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            const direction = e.key === "ArrowUp" ? "up" : "down";
            const next = sapPageBudgetArrowStep
              ? sapPageBudgetArrowStep(sapPageBudgetInput, direction)
              : stepSapPageBudgetInput(sapPageBudgetInput, direction === "up" ? 1 : -1);
            if (next === null) return;
            e.preventDefault();
            onSapPageBudgetInputChange(next);
          }}
          className={cn(
            BULK_HEADER_FIELD,
            "w-[3.25rem] shrink-0 text-center font-mono text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-auto [&::-webkit-outer-spin-button]:appearance-auto",
          )}
          disabled={runLoading}
          aria-label={sapPageBudgetAriaLabel}
          title={sapPageBudgetTitle}
        />
        <Input
          type="text"
          placeholder="Keyword"
          value={suggestFocusKeyword}
          onChange={(e) => onSuggestFocusKeywordChange(e.target.value)}
          className={cn(BULK_HEADER_FIELD, "w-[7rem] shrink-0 text-base")}
          disabled={runLoading}
          autoComplete="off"
          aria-label="Keyword"
        />
        <Input
          type="text"
          placeholder="Location"
          value={suggestFocusLocation}
          onChange={(e) => onSuggestFocusLocationChange(e.target.value)}
          className={cn(BULK_HEADER_FIELD, "w-[7rem] shrink-0 text-base")}
          disabled={runLoading}
          autoComplete="off"
          aria-label="Location"
        />

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
          <SelectTrigger
            className={cn(BULK_HEADER_SELECT_TRIGGER, "h-8 w-fit max-w-none shrink-0")}
            style={{ width: entityFocusMinWidth }}
            aria-label="Entity type focus"
          >
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
      </div>

      <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2" role="group" aria-label="Run and export">
        <Button
          type="button"
          size="sm"
          className={BULK_HEADER_RUN_BTN}
          disabled={runDisabled}
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
          className={LOCAL_EXPORT_BTN_CLASS}
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
          <Eraser className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
