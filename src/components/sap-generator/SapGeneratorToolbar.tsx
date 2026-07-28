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
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={sapPageBudgetInput}
          onChange={(e) => {
            onSapPageBudgetInputChange(e.target.value.replace(/[^\d]/g, ""));
          }}
          className={cn(
            BULK_HEADER_FIELD,
            "w-[3.25rem] shrink-0 text-center font-mono text-base",
          )}
          disabled={runLoading}
          aria-label="SAP page budget"
          title="Total SAP pages for this run"
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
