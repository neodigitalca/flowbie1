import React, { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { TaskTriggerFields } from "@/components/manager/tasks/TaskTriggerFields";
import { AutomationSchedulePanel } from "@/components/manager/tasks/planner/AutomationSchedulePanel";
import { AutomationBlockPicker } from "@/components/manager/tasks/planner/AutomationBlockPicker";
import {
  TASK_FORM_FLAT_CONTROL_CLASS,
  TASK_FORM_SELECT_CONTENT_CLASS,
  TASK_FORM_SELECT_ITEM_CLASS,
  TASK_FORM_SELECT_TRIGGER_CLASS,
  TaskFormCompactCell,
  TaskFormFlatGrid,
} from "@/components/manager/tasks/TaskFormLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AutomationBlockCatalogItem } from "@/lib/automation-blocks-api";
import type {
  AutomationGscTriggerBlock,
  AutomationPollTriggerBlock,
  AutomationScheduleBlock,
  AutomationTriggerBlock,
} from "@/lib/automation-planner-types";
import { defaultTaskTriggerConfig, partsToPollHours, pollHoursToParts } from "@/lib/task-trigger-types";
import { cn } from "@/lib/utils";

/** Reserve space for the tallest WHEN variant (GSC) so preset switches do not shift layout. */
const WHEN_DETAIL_MIN_H = "min-h-[19rem]";

export type AutomationWhenPanelProps = {
  trigger: AutomationTriggerBlock;
  triggerBlocks: AutomationBlockCatalogItem[];
  disabled?: boolean;
  onChange: (trigger: AutomationTriggerBlock) => void;
};

function applyTriggerBlockDefaults(
  block: AutomationBlockCatalogItem,
  current: AutomationTriggerBlock,
): AutomationTriggerBlock {
  const defaults = block.defaults ?? {};
  if (block.kind === "calendar") {
    const d = defaults as Partial<AutomationScheduleBlock>;
    return {
      keyword: block.keyword,
      kind: "calendar",
      frequency: d.frequency ?? "monthly",
      startDate: d.startDate ?? "2026-09-01",
      time: d.time ?? "09:00",
      targetBucket: current.targetBucket,
    };
  }
  if (block.kind === "poll") {
    const d = defaults as Partial<AutomationPollTriggerBlock>;
    return {
      keyword: block.keyword,
      kind: "poll",
      pollHours: d.pollHours ?? 24,
      targetBucket: current.targetBucket,
      triggerConfig: d.triggerConfig ?? { ...defaultTaskTriggerConfig(), sources: ["schedule"] },
    };
  }
  const d = defaults as Partial<AutomationGscTriggerBlock>;
  return {
    keyword: block.keyword,
    kind: "gsc",
    source: d.source ?? "gsc",
    targetBucket: current.targetBucket,
    triggerConfig: d.triggerConfig ?? defaultTaskTriggerConfig(),
  };
}

export function AutomationWhenPanel({
  trigger,
  triggerBlocks,
  disabled = false,
  onChange,
}: AutomationWhenPanelProps): React.ReactElement {
  const scheduleBlocks = useMemo(
    () => triggerBlocks.filter((b) => b.kind === "calendar"),
    [triggerBlocks],
  );
  const gscBlocks = useMemo(
    () => triggerBlocks.filter((b) => b.kind === "gsc"),
    [triggerBlocks],
  );
  const pollBlocks = useMemo(
    () => triggerBlocks.filter((b) => b.kind === "poll"),
    [triggerBlocks],
  );

  const handleSelect = (keyword: string) => {
    const block = triggerBlocks.find((b) => b.keyword === keyword);
    if (!block) return;
    onChange(applyTriggerBlockDefaults(block, trigger));
  };

  const pollParts = pollHoursToParts(trigger.kind === "poll" ? trigger.pollHours : 24);

  return (
    <div className="flex flex-col gap-1">
      <AutomationBlockPicker
        label="WHEN preset"
        blocks={[...scheduleBlocks, ...gscBlocks, ...pollBlocks]}
        selectedKeyword={trigger.keyword}
        disabled={disabled}
        onSelect={handleSelect}
      />

      <div className={cn("relative w-full", WHEN_DETAIL_MIN_H)}>
        <div
          className={cn(
            "absolute inset-0 flex flex-col gap-1",
            trigger.kind !== "calendar" && "pointer-events-none invisible",
          )}
        >
          <AutomationSchedulePanel
            block={
              trigger.kind === "calendar"
                ? trigger
                : {
                    keyword: "schedule-monthly",
                    kind: "calendar",
                    frequency: "monthly",
                    startDate: "2026-09-01",
                    time: "09:00",
                  }
            }
            disabled={disabled || trigger.kind !== "calendar"}
            onChange={(patch) => {
              if (trigger.kind !== "calendar") return;
              onChange({ ...trigger, ...patch });
            }}
          />
        </div>

        <div
          className={cn(
            "absolute inset-0 overflow-y-auto",
            trigger.kind !== "gsc" && "pointer-events-none invisible",
          )}
        >
          <TaskTriggerFields
            layout="inline"
            triggerConfig={
              trigger.kind === "gsc" ? trigger.triggerConfig : defaultTaskTriggerConfig()
            }
            executionPayload={{
              targetBucket: trigger.kind === "gsc" ? trigger.targetBucket : undefined,
            }}
            disabled={disabled || trigger.kind !== "gsc"}
            onChange={(triggerConfig) => {
              if (trigger.kind !== "gsc") return;
              onChange({ ...trigger, triggerConfig });
            }}
            onExecutionPayloadChange={(executionPayload) => {
              if (trigger.kind !== "gsc") return;
              onChange({ ...trigger, targetBucket: executionPayload.targetBucket });
            }}
          />
        </div>

        <div
          className={cn(
            "absolute inset-0",
            trigger.kind !== "poll" && "pointer-events-none invisible",
          )}
        >
          <TaskFormFlatGrid className="grid-cols-2">
            <TaskFormCompactCell label="Poll every">
              <Input
                type="number"
                min={1}
                value={trigger.kind === "poll" ? pollParts.value : 1}
                disabled={disabled || trigger.kind !== "poll"}
                className={TASK_FORM_FLAT_CONTROL_CLASS}
                onChange={(e) => {
                  if (trigger.kind !== "poll") return;
                  const value = Math.max(1, Number(e.target.value) || 1);
                  const pollHours = partsToPollHours(value, pollParts.unit);
                  onChange({
                    ...trigger,
                    pollHours,
                    triggerConfig: { ...trigger.triggerConfig, pollHours },
                  });
                }}
              />
            </TaskFormCompactCell>
            <TaskFormCompactCell label="Unit">
              <Select
                value={trigger.kind === "poll" ? pollParts.unit : "days"}
                onValueChange={(unit) => {
                  if (trigger.kind !== "poll") return;
                  const pollHours = partsToPollHours(pollParts.value, unit as typeof pollParts.unit);
                  onChange({
                    ...trigger,
                    pollHours,
                    triggerConfig: { ...trigger.triggerConfig, pollHours },
                  });
                }}
                disabled={disabled || trigger.kind !== "poll"}
              >
                <SelectTrigger className={TASK_FORM_SELECT_TRIGGER_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={TASK_FORM_SELECT_CONTENT_CLASS}>
                  <SelectItem value="hours" className={TASK_FORM_SELECT_ITEM_CLASS}>
                    Hours
                  </SelectItem>
                  <SelectItem value="days" className={TASK_FORM_SELECT_ITEM_CLASS}>
                    Days
                  </SelectItem>
                </SelectContent>
              </Select>
            </TaskFormCompactCell>
          </TaskFormFlatGrid>
        </div>
      </div>
    </div>
  );
}
