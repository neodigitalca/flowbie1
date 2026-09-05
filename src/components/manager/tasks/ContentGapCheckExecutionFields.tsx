import React, { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { getStoredSites } from "@/components/integrations/storage";
import {
  TaskFormFieldGrid,
  TaskFormInfield,
  TaskFormInfieldSelect,
  TaskFormPanel,
  TASK_FORM_FLAT_CONTROL_CLASS,
} from "@/components/manager/tasks/TaskFormLayout";
import { WorkspacePill } from "@/components/shared/WorkspacePill";
import { ensureContentGapCheckPayload } from "@/lib/content-gap/resolve-content-gap-count";
import {
  isOverviewPostsSourceAvailable,
  isOverviewSapSourceAvailable,
} from "@/lib/overview/overview-sitemap-source";
import type {
  ContentGapCountMode,
  ContentGapSitemapSource,
  TaskExecutionPayload,
} from "@/lib/tasks-types";
import { cn } from "@/lib/utils";

export { ensureContentGapCheckPayload } from "@/lib/content-gap/resolve-content-gap-count";

const COUNT_MODE_OPTIONS: { value: ContentGapCountMode; label: string }[] = [
  { value: "sitemap", label: "Sitemap total" },
  { value: "editorial_month", label: "Scheduled and posted in month" },
  { value: "scheduled_month", label: "Scheduled in month" },
  { value: "posted_month", label: "Posted in month" },
];

const SITEMAP_OPTIONS: { value: ContentGapSitemapSource; label: string }[] = [
  { value: "posts", label: "Posts" },
  { value: "sap", label: "SAP" },
];

function clampDayOfMonth(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(31, Math.max(1, Math.floor(value)));
}

function ContentGapDayOfMonthField({
  dayOfMonth,
  disabled = false,
  onChange,
}: {
  dayOfMonth: number;
  disabled?: boolean;
  onChange: (day: number) => void;
}): React.ReactElement {
  return (
    <div className="flex h-9 min-w-0 items-center gap-2 rounded-none bg-black px-3">
      <Input
        type="number"
        min={1}
        max={31}
        step={1}
        inputMode="numeric"
        value={String(dayOfMonth)}
        disabled={disabled}
        aria-label="Day of the month"
        className={cn(TASK_FORM_FLAT_CONTROL_CLASS, "w-12 shrink-0 tabular-nums")}
        onChange={(event) => {
          const next = Number.parseInt(event.target.value, 10);
          onChange(clampDayOfMonth(next));
        }}
      />
      <span className="shrink-0 whitespace-nowrap text-base text-muted-foreground">day of the month</span>
    </div>
  );
}

export type ContentGapCheckExecutionFieldsProps = {
  executionPayload?: TaskExecutionPayload | null;
  disabled?: boolean;
  layout?: "stack" | "workflow";
  clientSiteId?: string;
  onChange: (payload: TaskExecutionPayload) => void;
};

export function ContentGapCheckExecutionFields({
  executionPayload,
  disabled = false,
  layout = "stack",
  clientSiteId = "",
  onChange,
}: ContentGapCheckExecutionFieldsProps): React.ReactElement {
  const payload = ensureContentGapCheckPayload(executionPayload);
  const workflow = layout === "workflow";

  const site = useMemo(() => {
    const id = clientSiteId.trim();
    if (!id) return null;
    return getStoredSites().find((item) => item.id === id) ?? null;
  }, [clientSiteId]);

  const postsAvailable = site ? isOverviewPostsSourceAvailable(site) : true;
  const sapAvailable = site ? isOverviewSapSourceAvailable(site) : false;

  const patch = (partial: Partial<TaskExecutionPayload>) => {
    onChange(ensureContentGapCheckPayload({ ...payload, ...partial }));
  };

  const sitemapSource = payload.contentGapSitemapSource ?? "posts";
  const countMode = payload.contentGapCountMode ?? "editorial_month";
  const targetCount = payload.contentGapTargetCount ?? 4;
  const dayOfMonth = payload.contentGapDayOfMonth ?? 1;
  const showDayOfMonth =
    countMode === "editorial_month" || countMode === "scheduled_month" || countMode === "posted_month";

  const fields = (
    <>
      <TaskFormInfield label="Content">
        <div className="flex min-w-0 flex-wrap items-center gap-1" role="group" aria-label="Content type">
          {SITEMAP_OPTIONS.map((option) => {
            const optionDisabled =
              disabled ||
              (option.value === "posts" && !postsAvailable) ||
              (option.value === "sap" && !sapAvailable);
            return (
              <WorkspacePill
                key={option.value}
                label={option.label}
                square
                tone={workflow ? "forge" : "default"}
                active={sitemapSource === option.value}
                disabled={optionDisabled}
                onClick={() => patch({ contentGapSitemapSource: option.value })}
              />
            );
          })}
        </div>
      </TaskFormInfield>
      <TaskFormInfieldSelect
        label="Count mode"
        value={countMode}
        disabled={disabled}
        options={COUNT_MODE_OPTIONS}
        onChange={(value) => patch({ contentGapCountMode: value as ContentGapCountMode })}
      />
      {showDayOfMonth ? (
        <TaskFormInfield label="Day of month">
          <ContentGapDayOfMonthField
            dayOfMonth={dayOfMonth}
            disabled={disabled}
            onChange={(day) => patch({ contentGapDayOfMonth: day })}
          />
        </TaskFormInfield>
      ) : null}
      <TaskFormInfield label="Target">
        <Input
          type="number"
          min={1}
          step={1}
          value={String(targetCount)}
          disabled={disabled}
          className="bg-zinc-900 text-base"
          onChange={(event) => {
            const next = Number.parseInt(event.target.value, 10);
            patch({ contentGapTargetCount: Number.isFinite(next) && next > 0 ? next : 1 });
          }}
        />
      </TaskFormInfield>
    </>
  );

  if (workflow) {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_5rem] gap-0.5">
          <TaskFormInfield label="Content">
            <div className="flex min-w-0 flex-wrap items-center gap-1" role="group" aria-label="Content type">
              {SITEMAP_OPTIONS.map((option) => {
                const optionDisabled =
                  disabled ||
                  (option.value === "posts" && !postsAvailable) ||
                  (option.value === "sap" && !sapAvailable);
                return (
                  <WorkspacePill
                    key={option.value}
                    label={option.label}
                    square
                    tone="forge"
                    active={sitemapSource === option.value}
                    disabled={optionDisabled}
                    onClick={() => patch({ contentGapSitemapSource: option.value })}
                  />
                );
              })}
            </div>
          </TaskFormInfield>
          <TaskFormInfield label="Target">
            <Input
              type="number"
              min={1}
              step={1}
              value={String(targetCount)}
              disabled={disabled}
              className={cn(TASK_FORM_FLAT_CONTROL_CLASS, "w-full tabular-nums")}
              onChange={(event) => {
                const next = Number.parseInt(event.target.value, 10);
                patch({ contentGapTargetCount: Number.isFinite(next) && next > 0 ? next : 1 });
              }}
            />
          </TaskFormInfield>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-0.5">
          <TaskFormInfieldSelect
            label="Count mode"
            value={countMode}
            disabled={disabled}
            options={COUNT_MODE_OPTIONS}
            onChange={(value) => patch({ contentGapCountMode: value as ContentGapCountMode })}
          />
          <TaskFormInfield label="Day of month">
            <div className={cn("h-9 min-w-0", !showDayOfMonth && "invisible pointer-events-none")}>
              <ContentGapDayOfMonthField
                dayOfMonth={dayOfMonth}
                disabled={disabled || !showDayOfMonth}
                onChange={(day) => patch({ contentGapDayOfMonth: day })}
              />
            </div>
          </TaskFormInfield>
        </div>
      </div>
    );
  }

  return (
    <TaskFormPanel title="Content gap check">
      <TaskFormFieldGrid className="grid-cols-1 sm:grid-cols-1">{fields}</TaskFormFieldGrid>
    </TaskFormPanel>
  );
}
