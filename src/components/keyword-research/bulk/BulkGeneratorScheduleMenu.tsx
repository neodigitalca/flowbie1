import { CalendarClock, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  WordPressScheduleFields,
  type WordPressScheduleFieldsProps,
} from "@/components/keyword-research/bulk/WordPressScheduleFields";
import { BULK_HEADER_TOOL_BTN } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import { formatBulkScheduleSummary } from "@/lib/bulk/bulk-schedule-summary";
import { downloadWpInventoryKbJsonByName } from "@/lib/bulk/download-wp-inventory-kb-json";
import type { WordPressPostDestination } from "@/lib/bulk-auto-generate";
import { cn } from "@/lib/utils";

export type BulkGeneratorScheduleMenuProps = WordPressScheduleFieldsProps & {
  postDestination: WordPressPostDestination;
  inventoryDownloadFileName?: string | null;
};

export function BulkGeneratorScheduleMenu({
  postDestination,
  inventoryDownloadFileName = null,
  isDisabled = false,
  ...scheduleProps
}: BulkGeneratorScheduleMenuProps) {
  if (postDestination === "local") {
    return null;
  }

  const summary = formatBulkScheduleSummary({
    scheduleFrequency: scheduleProps.scheduleFrequency,
    customInterval: scheduleProps.customInterval,
    dayOfWeek: scheduleProps.dayOfWeek,
    startDateOption: scheduleProps.startDateOption,
    customStartDate: scheduleProps.customStartDate,
    startTime: scheduleProps.startTime,
    draftOnly: scheduleProps.wordpressDraftOnly,
  });

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(BULK_HEADER_TOOL_BTN, "max-w-[14rem] shrink-0 gap-1.5 px-2")}
            disabled={isDisabled}
            aria-label={`Post schedule: ${summary}`}
            title={summary}
          >
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{summary}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-3" align="start">
          <p className="mb-2 text-base font-medium text-foreground">Post schedule</p>
          <WordPressScheduleFields {...scheduleProps} isDisabled={isDisabled} layout="stack" />
        </PopoverContent>
      </Popover>
      {inventoryDownloadFileName ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(BULK_HEADER_TOOL_BTN, "h-8 w-8 shrink-0 p-0")}
          disabled={isDisabled}
          aria-label="Download site inventory JSON"
          title="Download site inventory JSON"
          onClick={() => downloadWpInventoryKbJsonByName(inventoryDownloadFileName)}
        >
          <FileJson className="h-4 w-4 shrink-0" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
