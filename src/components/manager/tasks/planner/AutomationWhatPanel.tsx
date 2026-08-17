import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  TASK_FORM_FLAT_CONTROL_CLASS,
  TaskFormFlatGrid,
  TaskFormFlatSelectPlaceholder,
  TaskFormInlineRow,
  TaskFormPanel,
} from "@/components/manager/tasks/TaskFormLayout";
import { AutomationWhatAspectPills } from "@/components/manager/tasks/planner/AutomationWhatAspectPills";
import { PostCreatorExecutionFields } from "@/components/manager/tasks/PostCreatorExecutionFields";
import { GscReportingExecutionFields } from "@/components/manager/tasks/GscReportingExecutionFields";
import { LocalDominatorExportExecutionFields } from "@/components/manager/tasks/LocalDominatorExportExecutionFields";
import { TaskExecutionTargetFields } from "@/components/manager/tasks/TaskExecutionTargetFields";
import { WorkspacePill } from "@/components/shared/WorkspacePill";
import {
  AUTOMATION_RECIPE_BUCKET_LABELS,
  AUTOMATION_RECIPE_CATEGORY_ORDER,
  automationRecipeCategoryLabel,
} from "@/lib/automation-recipes-filters";
import type { AutomationBlockCatalogItem } from "@/lib/automation-blocks-api";
import {
  filterAutomationActionBlocks,
  mergeActionBlockFilterOptions,
  type AutomationActionBlockListQuery,
} from "@/lib/automation-action-block-filters";
import type { AutomationActionBlock } from "@/lib/automation-planner-types";
import { ensurePostCreatorPayload } from "@/lib/post-creator/post-creator-defaults";
import {
  ensureOptimizationOptions,
  inferOptimizerKindFromOptions,
  inferOptimizerKeywordFromOptions,
} from "@/lib/task-optimization-options-defaults";
import type { TaskExecutionKind, TaskExecutionPayload } from "@/lib/tasks-types";
import { BULK_HEADER_SELECT } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";

const SCHEDULE_PAYLOAD_KEYS: (keyof TaskExecutionPayload)[] = [
  "scheduleFrequency",
  "scheduleCustomInterval",
  "scheduleDayOfWeek",
  "scheduleStartDateOption",
  "scheduleCustomStartDate",
  "scheduleTimesPerMonth",
  "scheduleStartDay",
  "scheduleStartTime",
  "scheduleStaggerOptimized",
  "scheduleDraftOnly",
  "saveLocalArchive",
  "sendAutomationEmail",
  "automationEmailTo",
  "automationEmailSubject",
  "automationEmailMessage",
  "automationEmailAiIntro",
];

const ACTION_KIND_PILLS: { keyword: string; label: string; kind: TaskExecutionKind }[] = [
  { keyword: "post-creator-monthly", label: "Post creator", kind: "post_creator" },
  { keyword: "gsc-report-mom", label: "GSC MoM", kind: "gsc_reporting" },
  { keyword: "gsc-report-yoy", label: "GSC YoY", kind: "gsc_reporting" },
  { keyword: "local-dominator-grid-export", label: "Local Dominator grid", kind: "local_dominator_export" },
];

function preserveSchedulePayload(
  current: TaskExecutionPayload,
  next: TaskExecutionPayload,
): TaskExecutionPayload {
  const preserved: Partial<TaskExecutionPayload> = {};
  for (const key of SCHEDULE_PAYLOAD_KEYS) {
    if (current[key] !== undefined) preserved[key] = current[key];
  }
  return { ...next, ...preserved };
}

function applyActionBlockDefaults(
  block: AutomationBlockCatalogItem,
  current: AutomationActionBlock,
): AutomationActionBlock {
  const d = (block.defaults?.executionPayload ?? {}) as TaskExecutionPayload;
  let mergedPayload = preserveSchedulePayload(current.executionPayload, {
    ...current.executionPayload,
    ...d,
  });
  const kind = (block.executionKind ?? current.executionKind) as TaskExecutionKind;
  if (kind === "content_optimizer" || kind === "content_optimizer_meta") {
    mergedPayload = ensureOptimizationOptions(mergedPayload, block.keyword);
  }
  return {
    keyword: block.keyword,
    executionKind: kind,
    executionPayload: mergedPayload,
    title: current.title,
  };
}

function FilterSelect({
  value,
  onChange,
  children,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  "aria-label": string;
}): React.ReactElement {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className={`${BULK_HEADER_SELECT} h-8 shrink-0 text-base [color-scheme:dark]`}
    >
      {children}
    </select>
  );
}

export type AutomationWhatPanelProps = {
  action: AutomationActionBlock;
  actionBlocks: AutomationBlockCatalogItem[];
  disabled?: boolean;
  pillTone?: "default" | "forge" | "monochrome";
  onChange: (action: AutomationActionBlock) => void;
};

export function AutomationWhatPanel({
  action,
  actionBlocks,
  disabled = false,
  pillTone = "default",
  onChange,
}: AutomationWhatPanelProps): React.ReactElement {
  const [query, setQuery] = useState<AutomationActionBlockListQuery>({});

  const filterOptions = useMemo(
    () => mergeActionBlockFilterOptions(actionBlocks),
    [actionBlocks],
  );

  const filteredBlocks = useMemo(
    () => filterAutomationActionBlocks(actionBlocks, query),
    [actionBlocks, query],
  );

  const visibleActionPills = useMemo(
    () =>
      ACTION_KIND_PILLS.filter((pill) =>
        filteredBlocks.some((block) => block.keyword === pill.keyword),
      ),
    [filteredBlocks],
  );

  const patchQuery = useCallback((patch: Partial<AutomationActionBlockListQuery>) => {
    setQuery((current) => ({ ...current, ...patch }));
  }, []);

  const handleSelectBlock = (keyword: string) => {
    const block = actionBlocks.find((b) => b.keyword === keyword);
    if (!block) return;
    onChange(applyActionBlockDefaults(block, action));
  };

  const patchPayload = (partial: Partial<TaskExecutionPayload>) => {
    onChange({
      ...action,
      executionPayload: { ...action.executionPayload, ...partial },
    });
  };

  const kind = action.executionKind;
  const isOptimizer = kind === "content_optimizer" || kind === "content_optimizer_meta";
  const optimizerPayload = isOptimizer
    ? ensureOptimizationOptions(action.executionPayload, action.keyword)
    : action.executionPayload;

  const handleAspectChange = (executionPayload: TaskExecutionPayload) => {
    const options = executionPayload.optimizationOptions ?? {};
    const executionKind = inferOptimizerKindFromOptions(options);
    const keyword = inferOptimizerKeywordFromOptions(options);
    onChange({
      ...action,
      keyword,
      executionKind,
      executionPayload,
    });
  };

  useEffect(() => {
    if (filteredBlocks.length === 0) return;
    if (filteredBlocks.some((block) => block.keyword === action.keyword)) return;
    onChange(applyActionBlockDefaults(filteredBlocks[0], action));
  }, [action, filteredBlocks, onChange]);

  const showAspectPills =
    isOptimizer || visibleActionPills.length === 0;

  return (
    <div className="flex flex-col gap-3 rounded-none bg-zinc-900/50 p-4">
      <div className="flex flex-wrap items-center gap-2 bg-black px-3 py-2">
        <FilterSelect
          aria-label="Category"
          value={query.category ?? ""}
          onChange={(category) => patchQuery({ category: category || undefined })}
        >
          <option value="">All categories</option>
          {AUTOMATION_RECIPE_CATEGORY_ORDER.filter((cat) => filterOptions.categories.includes(cat)).map(
            (cat) => (
              <option key={cat} value={cat}>
                {automationRecipeCategoryLabel(cat)}
              </option>
            ),
          )}
        </FilterSelect>
        <FilterSelect
          aria-label="Bucket"
          value={query.bucket ?? ""}
          onChange={(bucket) => patchQuery({ bucket: bucket || undefined })}
        >
          <option value="">All buckets</option>
          {filterOptions.buckets.map((bucket) => (
            <option key={bucket} value={bucket}>
              {AUTOMATION_RECIPE_BUCKET_LABELS[bucket] ?? bucket}
            </option>
          ))}
        </FilterSelect>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {showAspectPills ? (
          <AutomationWhatAspectPills
            executionPayload={
              isOptimizer
                ? optimizerPayload
                : ensureOptimizationOptions(action.executionPayload, "content-optimizer-full")
            }
            disabled={disabled}
            pillTone={pillTone}
            onChange={handleAspectChange}
          />
        ) : null}
        {!isOptimizer
          ? visibleActionPills.map(({ keyword, label, kind: pillKind }) => (
              <WorkspacePill
                key={keyword}
                label={label}
                square
                tone={pillTone}
                active={action.keyword === keyword && action.executionKind === pillKind}
                disabled={disabled}
                onClick={() => handleSelectBlock(keyword)}
              />
            ))
          : null}
      </div>

      <TaskFormInlineRow label="Run title">
        <Input
          value={action.title ?? ""}
          onChange={(e) => onChange({ ...action, title: e.target.value })}
          placeholder="Optional task title"
          disabled={disabled}
          className={TASK_FORM_FLAT_CONTROL_CLASS}
        />
      </TaskFormInlineRow>

      {isOptimizer ? (
        <TaskFormPanel title="Scope">
          <TaskFormFlatGrid className="grid-cols-2">
            <TaskExecutionTargetFields
              variant="flatPlaceholder"
              bucketLabel="Target bucket"
              executionPayload={optimizerPayload}
              disabled={disabled}
              onChange={(executionPayload) => onChange({ ...action, executionPayload })}
            />
            <TaskFormFlatSelectPlaceholder
              placeholder="Update mode"
              value={optimizerPayload.updateMode ?? "update"}
              onChange={(v) => patchPayload({ updateMode: v as TaskExecutionPayload["updateMode"] })}
              disabled={disabled}
              options={[
                { value: "update", label: "Update live" },
                { value: "draft", label: "Draft only" },
              ]}
            />
          </TaskFormFlatGrid>
        </TaskFormPanel>
      ) : null}

      {kind === "post_creator" ? (
        <PostCreatorExecutionFields
          surface="what"
          executionPayload={ensurePostCreatorPayload(action.executionPayload)}
          disabled={disabled}
          onChange={(executionPayload) =>
            onChange({
              ...action,
              executionKind: "post_creator",
              executionPayload: ensurePostCreatorPayload(executionPayload),
            })
          }
        />
      ) : null}

      {kind === "gsc_reporting" ? (
        <TaskFormPanel title="Report">
          <GscReportingExecutionFields
            layout="inline"
            executionPayload={action.executionPayload}
            disabled={disabled}
            onChange={(executionPayload) =>
              onChange({ ...action, executionKind: "gsc_reporting", executionPayload })
            }
          />
        </TaskFormPanel>
      ) : null}

      {kind === "local_dominator_export" ? (
        <TaskFormPanel title="Local Dominator grid">
          <LocalDominatorExportExecutionFields
            layout="inline"
            executionPayload={action.executionPayload}
            disabled={disabled}
            onChange={(executionPayload) =>
              onChange({ ...action, executionKind: "local_dominator_export", executionPayload })
            }
          />
        </TaskFormPanel>
      ) : null}
    </div>
  );
}
