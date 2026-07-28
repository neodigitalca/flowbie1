import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  computeBulkScheduleStartPreset,
  type BulkScheduleStartPreset,
} from "@/lib/bulk/bulk-schedule-summary";
import {
  applyBulkScheduleStartPreset,
  formatPresetLabelFromValues,
  listBulkSchedulePresets,
  loadUserBulkSchedulePresets,
  saveUserBulkSchedulePresets,
  type BulkNamedSchedulePreset,
  type BulkNamedSchedulePresetValues,
} from "@/lib/bulk/bulk-schedule-presets";
import {
  clampEveryNDays,
  clampTimesPerMonth,
  dateForPickDatePreset,
  getFirstOfThisMonthDate,
  getNextFirstOfMonthDate,
  isSameLocalCalendarDay,
  type ScheduleFrequency,
} from "@/lib/wordpress-scheduler";
import { cn } from "@/lib/utils";

const BULK_FIELD_TRIGGER =
  "h-9 w-full min-w-0 border-0 bg-muted/55 text-foreground text-base font-medium shadow-none ring-0 outline-none focus:ring-2 focus:ring-primary/45 focus:ring-offset-0 [&>span]:text-foreground";
const BULK_FIELD_INPUT =
  "h-9 w-full min-w-0 border-0 bg-muted/55 text-foreground text-base font-medium shadow-none ring-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-0";

export type WordPressScheduleFieldsProps = {
  scheduleFrequency: ScheduleFrequency;
  setScheduleFrequency: (value: ScheduleFrequency) => void;
  customInterval: number;
  setCustomInterval: (value: number) => void;
  dayOfWeek: number;
  setDayOfWeek: (value: number) => void;
  startDateOption: "immediate" | "custom";
  setStartDateOption: (value: "immediate" | "custom") => void;
  customStartDate: Date;
  setCustomStartDate: (value: Date) => void;
  startTime: string;
  setStartTime: (value: string) => void;
  useCsvPublishDates: boolean;
  setUseCsvPublishDates: (value: boolean) => void;
  wordpressDraftOnly: boolean;
  setWordpressDraftOnly: (value: boolean) => void;
  isDisabled?: boolean;
  gbpMode?: boolean;
  useGapScheduling?: boolean;
  scheduleOccupancyLoading?: boolean;
  layout?: "grid" | "stack";
};

export function WordPressScheduleFields({
  scheduleFrequency,
  setScheduleFrequency,
  customInterval,
  setCustomInterval,
  dayOfWeek,
  setDayOfWeek,
  startDateOption,
  setStartDateOption,
  customStartDate,
  setCustomStartDate,
  startTime,
  setStartTime,
  useCsvPublishDates,
  setUseCsvPublishDates,
  wordpressDraftOnly,
  setWordpressDraftOnly,
  isDisabled = false,
  gbpMode = false,
  useGapScheduling = false,
  scheduleOccupancyLoading = false,
  layout = "grid",
}: WordPressScheduleFieldsProps) {
  const [namedPresets, setNamedPresets] = useState<BulkNamedSchedulePreset[]>(() =>
    listBulkSchedulePresets(),
  );
  const startPreset = useMemo(
    () => computeBulkScheduleStartPreset(startDateOption, customStartDate, startTime),
    [startDateOption, customStartDate, startTime],
  );

  useEffect(() => {
    if (startDateOption !== "custom") return;
    setCustomStartDate((prev) => {
      const thisMonth = getFirstOfThisMonthDate(startTime);
      const nextFirst = getNextFirstOfMonthDate(startTime);
      if (isSameLocalCalendarDay(prev, thisMonth)) return thisMonth;
      if (isSameLocalCalendarDay(prev, nextFirst)) return nextFirst;
      return prev;
    });
  }, [startTime, startDateOption, setCustomStartDate]);

  const handleStartPresetChange = (value: BulkScheduleStartPreset) => {
    if (value === "immediate") {
      setStartDateOption("immediate");
      return;
    }
    setStartDateOption("custom");
    if (value === "firstOfThisMonth") {
      setCustomStartDate(getFirstOfThisMonthDate(startTime));
      return;
    }
    if (value === "firstOfNextMonth") {
      setCustomStartDate(getNextFirstOfMonthDate(startTime));
      return;
    }
    if (value === "pickDate") {
      setCustomStartDate(dateForPickDatePreset(startTime));
    }
  };

  const isImmediateFrequency = scheduleFrequency === "immediately";

  const handleFrequencyChange = (value: ScheduleFrequency) => {
    setScheduleFrequency(value);
    if (value === "immediately") {
      setUseCsvPublishDates(false);
    } else if (value === "everyNDays") {
      setCustomInterval((prev) => clampEveryNDays(prev));
    } else if (value === "custom") {
      setCustomInterval((prev) => clampTimesPerMonth(prev));
    }
  };

  const applyNamedPreset = (preset: BulkNamedSchedulePreset) => {
    const values = preset.values;
    setScheduleFrequency(values.scheduleFrequency);
    setCustomInterval(
      values.scheduleFrequency === "custom"
        ? clampTimesPerMonth(values.customInterval)
        : values.scheduleFrequency === "everyNDays"
          ? clampEveryNDays(values.customInterval)
          : values.customInterval,
    );
    setDayOfWeek(values.dayOfWeek);
    setStartTime(values.startTime);
    if (values.scheduleFrequency === "immediately") {
      setUseCsvPublishDates(false);
    }
    const start = applyBulkScheduleStartPreset(values.startPreset, values.startTime);
    setStartDateOption(start.startDateOption);
    if (start.customStartDate) setCustomStartDate(start.customStartDate);
  };

  const saveCurrentPreset = () => {
    const values: BulkNamedSchedulePresetValues = {
      scheduleFrequency,
      customInterval,
      dayOfWeek,
      startPreset,
      startTime,
    };
    const userPresets = loadUserBulkSchedulePresets();
    saveUserBulkSchedulePresets([
      ...userPresets,
      {
        id: `user-${Date.now()}`,
        label: formatPresetLabelFromValues(values),
        values,
      },
    ]);
    setNamedPresets(listBulkSchedulePresets());
  };

  const gridClass =
    layout === "stack"
      ? "flex flex-col gap-2"
      : "grid grid-cols-1 gap-1 sm:col-span-2 sm:grid-cols-2";

  return (
    <div className={gridClass}>
      <div className={cn("min-w-0", layout === "grid" && "sm:col-span-2")}>
        <Select
          value={wordpressDraftOnly ? "draft" : "scheduled"}
          onValueChange={(value) => setWordpressDraftOnly(value === "draft")}
          disabled={isDisabled}
        >
          <SelectTrigger className={BULK_FIELD_TRIGGER} aria-label="WordPress post status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="scheduled">Scheduled publish</SelectItem>
            <SelectItem value="draft">Draft only</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {wordpressDraftOnly ? null : (
        <>
      <div className={cn("grid min-w-0 grid-cols-2 gap-2", layout === "grid" && "sm:col-span-2")}>
        {namedPresets.slice(0, 2).map((preset) => (
          <Button
            key={preset.id}
            type="button"
            variant="secondary"
            className="h-auto min-h-9 whitespace-normal border-0 bg-primary/15 px-2 py-2 text-base font-medium text-foreground shadow-none hover:bg-primary/25"
            disabled={isDisabled}
            onClick={() => applyNamedPreset(preset)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <div className={cn("flex min-w-0 gap-2", layout === "grid" && "sm:col-span-2")}>
        <Select
          onValueChange={(id) => {
            const preset = namedPresets.find((item) => item.id === id);
            if (preset) applyNamedPreset(preset);
          }}
          disabled={isDisabled}
        >
          <SelectTrigger className={BULK_FIELD_TRIGGER} aria-label="Saved schedule presets">
            <SelectValue placeholder="Saved presets" />
          </SelectTrigger>
          <SelectContent>
            {namedPresets.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="secondary"
          className="h-9 shrink-0 border-0 bg-muted/55 px-3 text-base font-medium shadow-none hover:bg-muted/70"
          disabled={isDisabled}
          onClick={saveCurrentPreset}
        >
          Save preset
        </Button>
      </div>
      <div className="min-w-0">
        <Select
          value={scheduleFrequency}
          onValueChange={(value: ScheduleFrequency) => handleFrequencyChange(value)}
          disabled={isDisabled}
        >
          <SelectTrigger className={BULK_FIELD_TRIGGER} aria-label="Post frequency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="immediately">Immediately</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="everyNDays">Every N days</SelectItem>
            <SelectItem value="custom">Times per month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {scheduleFrequency === "everyNDays" ? (
        <div className="min-w-0">
          <Input
            type="number"
            min={1}
            max={365}
            value={customInterval}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              setCustomInterval(clampEveryNDays(Number.isNaN(value) ? 1 : value));
            }}
            disabled={isDisabled}
            className={BULK_FIELD_INPUT}
            aria-label="Every N days"
          />
        </div>
      ) : null}

      {scheduleFrequency === "weekly" ? (
        <div className={cn("min-w-0", layout === "grid" && "sm:col-span-2")}>
          <Select
            value={dayOfWeek.toString()}
            onValueChange={(value) => setDayOfWeek(parseInt(value, 10))}
            disabled={isDisabled}
          >
            <SelectTrigger className={BULK_FIELD_TRIGGER} aria-label="Day of week">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Sunday</SelectItem>
              <SelectItem value="1">Monday</SelectItem>
              <SelectItem value="2">Tuesday</SelectItem>
              <SelectItem value="3">Wednesday</SelectItem>
              <SelectItem value="4">Thursday</SelectItem>
              <SelectItem value="5">Friday</SelectItem>
              <SelectItem value="6">Saturday</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {scheduleFrequency === "custom" ? (
        <div className="min-w-0">
          <Input
            type="number"
            min="1"
            max="31"
            value={customInterval}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              setCustomInterval(clampTimesPerMonth(Number.isNaN(value) ? 1 : value));
            }}
            disabled={isDisabled}
            className={BULK_FIELD_INPUT}
            aria-label="Times per month"
          />
        </div>
      ) : null}

      {!isImmediateFrequency ? (
        <>
          <div className="min-w-0">
            <Select
              value={startPreset}
              onValueChange={(v) => handleStartPresetChange(v as BulkScheduleStartPreset)}
              disabled={isDisabled}
            >
              <SelectTrigger className={BULK_FIELD_TRIGGER} aria-label="Start date preset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Next available slot</SelectItem>
                <SelectItem value="firstOfThisMonth">First of this month</SelectItem>
                <SelectItem value="firstOfNextMonth">First of next month</SelectItem>
                <SelectItem value="pickDate">Pick a date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              disabled={isDisabled}
              className={cn(BULK_FIELD_INPUT, "tabular-nums")}
              aria-label="Post time"
            />
          </div>
        </>
      ) : null}

      {!isImmediateFrequency && startDateOption === "custom" && startPreset === "pickDate" ? (
        <div className={cn("min-w-0", layout === "grid" && "sm:col-span-2")}>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="secondary"
                className={cn(
                  BULK_FIELD_TRIGGER,
                  "justify-start border-0 text-left font-medium shadow-none hover:bg-muted/65",
                )}
                disabled={isDisabled}
                aria-label="Pick start date"
              >
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-90" />
                {customStartDate ? format(customStartDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customStartDate}
                onSelect={(date) => date && setCustomStartDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      ) : null}

      {useGapScheduling && scheduleOccupancyLoading ? (
        <p className={cn("text-base text-muted-foreground", layout === "grid" && "sm:col-span-2")}>
          Loading WordPress post inventory for gap scheduling…
        </p>
      ) : null}
        </>
      )}
    </div>
  );
}
