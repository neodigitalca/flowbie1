import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CONTENT_OPTIMIZER_MULTI_SITE_CLUSTER_RIGHT_CELL } from "@/components/overview/overview-tab/overview-tab-content-constants";
import {
  formatMultiSiteCompletedAtLabel,
  isoToLocalCalendarDate,
  localCalendarDateToIso,
} from "@/lib/content-optimizer/multi-site-last-completed-at";
import type { MultiSiteUrlSource } from "@/lib/content-optimizer/multi-site-source-urls";
import { cn } from "@/lib/utils";

export type MultiSiteRowDatePickerProps = {
  siteId: string;
  source: MultiSiteUrlSource;
  activityIso: string | undefined;
  fallbackLabel: string;
  title?: string;
  disabled?: boolean;
  onPick: (siteId: string, source: MultiSiteUrlSource, iso: string) => void;
};

export function MultiSiteRowDatePicker({
  siteId,
  source,
  activityIso,
  fallbackLabel,
  title,
  disabled = false,
  onPick,
}: MultiSiteRowDatePickerProps) {
  const label = formatMultiSiteCompletedAtLabel(activityIso) ?? fallbackLabel;
  const selected = useMemo(() => isoToLocalCalendarDate(activityIso), [activityIso]);

  if (disabled) {
    return (
      <div className="flex min-w-0 flex-1 items-center self-stretch">
        <div className={CONTENT_OPTIMIZER_MULTI_SITE_CLUSTER_RIGHT_CELL} title={title}>
          <span className="truncate !text-white">{label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center self-stretch">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              CONTENT_OPTIMIZER_MULTI_SITE_CLUSTER_RIGHT_CELL,
              "h-full w-full cursor-pointer rounded-none px-0 font-normal hover:bg-white/5",
            )}
            title={title ?? "Pick row date"}
            aria-label={`Set date for this row. Current: ${label}`}
          >
            <span className="min-w-0 truncate text-left !text-white">{label}</span>
          </Button>
        </PopoverTrigger>
      <PopoverContent className="w-auto border-0 bg-popover p-0" align="end">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (!date) return;
            onPick(siteId, source, localCalendarDateToIso(date));
          }}
          initialFocus
        />
      </PopoverContent>
      </Popover>
    </div>
  );
}
