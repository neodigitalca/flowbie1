import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BULK_HEADER_SELECT } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import {
  formatGscComparePeriodLabel,
  GSC_REPORTING_COMPARE_PRESET_OPTIONS,
  type GscCompareRanges,
  type GscReportingComparePresetId,
} from "@/lib/gsc-reporting/gsc-fetch-date-presets";
import { cn } from "@/lib/utils";

const PRESET_TRIGGER_LABEL: Record<GscReportingComparePresetId, string> = {
  mom: "Month vs month",
  yoy: "Year over year",
  custom_compare: "Custom ranges",
};

export type GscReportingComparePopoverProps = {
  busy: boolean;
  gscFetchPreset: GscReportingComparePresetId;
  onGscFetchPresetChange: (preset: GscReportingComparePresetId) => void;
  compareRangeDraft: GscCompareRanges;
  onCompareRangeDraftChange: (updater: (prev: GscCompareRanges) => GscCompareRanges) => void;
  todayYmdMax: string;
};

export function GscReportingComparePopover({
  busy,
  gscFetchPreset,
  onGscFetchPresetChange,
  compareRangeDraft,
  onCompareRangeDraftChange,
  todayYmdMax,
}: GscReportingComparePopoverProps) {
  const periodALabel = formatGscComparePeriodLabel(
    compareRangeDraft.primary.startDate,
    compareRangeDraft.primary.endDate,
  );
  const periodBLabel = formatGscComparePeriodLabel(
    compareRangeDraft.compare.startDate,
    compareRangeDraft.compare.endDate,
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          id="gsc-fetch-preset"
          disabled={busy}
          aria-label="GSC compare period preset"
          title={GSC_REPORTING_COMPARE_PRESET_OPTIONS.find((o) => o.id === gscFetchPreset)?.label}
          className={cn(
            BULK_HEADER_SELECT,
            "h-8 w-[9.5rem] shrink-0 justify-between gap-1 px-2 font-normal hover:bg-zinc-700",
          )}
        >
          <span className="truncate">{PRESET_TRIGGER_LABEL[gscFetchPreset]}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(calc(100vw-2rem),20rem)] space-y-3 border border-white/10 bg-zinc-900 p-3 shadow-lg"
      >
        <div className="space-y-1" role="radiogroup" aria-label="Compare preset">
          {GSC_REPORTING_COMPARE_PRESET_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={gscFetchPreset === o.id}
              disabled={busy}
              className={cn(
                "flex w-full rounded-none px-2.5 py-2 text-left text-base transition-colors",
                gscFetchPreset === o.id
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:bg-zinc-800 hover:text-foreground",
              )}
              onClick={() => onGscFetchPresetChange(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="space-y-3 border-t border-white/10 pt-3">
          {gscFetchPreset === "custom_compare" ? (
            <>
              <PeriodDateFields
                label="Period A"
                range={compareRangeDraft.primary}
                todayYmdMax={todayYmdMax}
                disabled={busy}
                onChange={(patch) => {
                  onGscFetchPresetChange("custom_compare");
                  onCompareRangeDraftChange((r) => ({
                    ...r,
                    primary: { ...r.primary, ...patch },
                  }));
                }}
              />
              <PeriodDateFields
                label="Period B"
                range={compareRangeDraft.compare}
                todayYmdMax={todayYmdMax}
                disabled={busy}
                onChange={(patch) => {
                  onGscFetchPresetChange("custom_compare");
                  onCompareRangeDraftChange((r) => ({
                    ...r,
                    compare: { ...r.compare, ...patch },
                  }));
                }}
              />
            </>
          ) : (
            <dl className="space-y-2 text-base">
              <div>
                <dt className="font-medium text-foreground">Period A</dt>
                <dd className="text-muted-foreground">{periodALabel}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Period B</dt>
                <dd className="text-muted-foreground">{periodBLabel}</dd>
              </div>
            </dl>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PeriodDateFields({
  label,
  range,
  todayYmdMax,
  disabled,
  onChange,
}: {
  label: string;
  range: { startDate: string; endDate: string };
  todayYmdMax: string;
  disabled: boolean;
  onChange: (patch: Partial<{ startDate: string; endDate: string }>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-base font-medium text-foreground">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-base text-muted-foreground">Start</span>
          <Input
            type="date"
            className={cn(BULK_HEADER_SELECT, "h-8 w-full px-2 font-sans")}
            max={todayYmdMax}
            disabled={disabled}
            value={range.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <span className="text-base text-muted-foreground">End</span>
          <Input
            type="date"
            className={cn(BULK_HEADER_SELECT, "h-8 w-full px-2 font-sans")}
            max={todayYmdMax}
            disabled={disabled}
            value={range.endDate}
            onChange={(e) => onChange({ endDate: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
