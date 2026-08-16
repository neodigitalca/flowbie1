import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TASK_FORM_SELECT_CONTENT_CLASS,
  TASK_FORM_SELECT_ITEM_CLASS,
  TASK_FORM_SELECT_TRIGGER_CLASS,
  TASK_FORM_SELECT_TRIGGER_NOWRAP_CLASS,
  TaskFormFieldGrid,
  TaskFormFlatGrid,
  TaskFormFlatSelectPlaceholder,
  TaskFormInfield,
  TaskFormPlaceholderCell,
} from "@/components/manager/tasks/TaskFormLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskExecutionTargetFields } from "@/components/manager/tasks/TaskExecutionTargetFields";
import type { TaskExecutionPayload } from "@/lib/tasks-types";
import type {
  TaskTriggerConfig,
  TaskTriggerCondition,
  TaskTriggerEvaluateResult,
  TaskTriggerSignal,
} from "@/lib/task-trigger-types";
import {
  TASK_TRIGGER_SIGNAL_DEFAULTS,
  TASK_TRIGGER_SIGNAL_LABELS,
  TASK_TRIGGER_SIGNALS,
  TASK_TRIGGER_SOURCE_OPTIONS,
  TASK_TRIGGER_SOURCE_SHORT_LABELS,
  POLL_INTERVAL_UNIT_LABELS,
  defaultTaskTriggerConfig,
  isScheduleOnlyTriggerSource,
  partsToPollHours,
  pollHoursToParts,
  primaryTriggerSource,
  type PollIntervalUnit,
  type TaskTriggerSource,
} from "@/lib/task-trigger-types";

const TRIGGER_ROW_CLASS = "h-9 min-h-9";
const TRIGGER_INLINE_INPUT_CLASS = `${TRIGGER_ROW_CLASS} rounded-none border-0 bg-zinc-900 text-base`;
const TRIGGER_PILL_CLASS = `${TRIGGER_ROW_CLASS} shrink-0 rounded-none px-2 text-base`;

export type TaskTriggerFieldsProps = {
  triggerConfig: TaskTriggerConfig;
  executionPayload?: TaskExecutionPayload | null;
  disabled?: boolean;
  layout?: "stack" | "inline";
  onChange: (config: TaskTriggerConfig) => void;
  onExecutionPayloadChange: (payload: TaskExecutionPayload) => void;
};

function conditionKey(condition: TaskTriggerCondition): string {
  return `${condition.signal}:${condition.operator}:${condition.value}:${condition.minImpressions ?? ""}`;
}

function TriggerStackedNumericCell({
  label,
  value,
  disabled,
  hidden,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  hidden?: boolean;
  onChange: (value: number) => void;
}): React.ReactElement {
  return (
    <TaskFormPlaceholderCell className={cn("min-w-0", hidden && "pointer-events-none invisible")}>
      <span className="whitespace-normal leading-tight text-base text-muted-foreground">{label}</span>
      <Input
        type="number"
        min={1}
        value={value}
        disabled={disabled || hidden}
        tabIndex={hidden ? -1 : 0}
        className={TRIGGER_INLINE_INPUT_CLASS}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value) || value))}
      />
    </TaskFormPlaceholderCell>
  );
}

function PollFrequencyField({
  pollHours,
  disabled,
  onChange,
}: {
  pollHours: number;
  disabled?: boolean;
  onChange: (pollHours: number) => void;
}): React.ReactElement {
  const { value, unit } = pollHoursToParts(pollHours);
  return (
    <TaskFormPlaceholderCell className="min-w-0">
      <span className="whitespace-normal leading-tight text-base text-muted-foreground">Poll frequency</span>
      <div className="flex min-w-0 items-center gap-1">
        <Input
          type="number"
          min={1}
          value={value}
          disabled={disabled}
          aria-label="Poll frequency value"
          className={cn(TRIGGER_INLINE_INPUT_CLASS, "min-w-0 flex-1")}
          onChange={(e) => {
            const nextValue = Math.max(1, Number(e.target.value) || value);
            onChange(partsToPollHours(nextValue, unit));
          }}
        />
        <Select
          value={unit}
          onValueChange={(v) => onChange(partsToPollHours(value, v as PollIntervalUnit))}
          disabled={disabled}
        >
          <SelectTrigger
            className={cn(TASK_FORM_SELECT_TRIGGER_CLASS, "h-9 w-auto shrink-0 px-2")}
            aria-label="Poll frequency unit"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={TASK_FORM_SELECT_CONTENT_CLASS}>
            {(Object.keys(POLL_INTERVAL_UNIT_LABELS) as PollIntervalUnit[]).map((u) => (
              <SelectItem key={u} value={u} className={TASK_FORM_SELECT_ITEM_CLASS}>
                {POLL_INTERVAL_UNIT_LABELS[u]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </TaskFormPlaceholderCell>
  );
}

function toggleCondition(
  conditions: TaskTriggerCondition[],
  signal: TaskTriggerSignal,
): TaskTriggerCondition[] {
  const existing = conditions.find((c) => c.signal === signal);
  if (existing) {
    return conditions.filter((c) => c.signal !== signal);
  }
  const defaults = TASK_TRIGGER_SIGNAL_DEFAULTS[signal];
  return [
    ...conditions,
    {
      signal,
      operator: defaults.operator,
      value: defaults.value,
      minImpressions: defaults.minImpressions,
    },
  ];
}

export function TaskTriggerFields({
  triggerConfig,
  executionPayload,
  disabled = false,
  layout = "stack",
  onChange,
  onExecutionPayloadChange,
}: TaskTriggerFieldsProps): React.ReactElement {
  const config = triggerConfig ?? defaultTaskTriggerConfig();
  const inline = layout === "inline";
  const activeSignals = useMemo(
    () => new Set(config.conditions.map((c) => c.signal)),
    [config.conditions],
  );

  const patchConfig = (patch: Partial<TaskTriggerConfig>) => onChange({ ...config, ...patch });
  const scheduleOnly = isScheduleOnlyTriggerSource(config.sources);
  const activeSource = primaryTriggerSource(config.sources);

  const handleSourceChange = (source: TaskTriggerSource) => {
    patchConfig({
      sources: [source],
      ...(source === "schedule" ? { conditions: [] } : {}),
    });
  };

  const sourceSelectOptions = TASK_TRIGGER_SOURCE_OPTIONS.filter((opt) => opt.enabled).map((opt) => ({
    value: opt.value,
    label: opt.label,
  }));

  const inlineSourceSelectOptions = TASK_TRIGGER_SOURCE_OPTIONS.filter((opt) => opt.enabled).map(
    (opt) => ({
      value: opt.value,
      label: TASK_TRIGGER_SOURCE_SHORT_LABELS[opt.value],
    }),
  );

  const signalsHeaderSecondary = scheduleOnly
    ? "Runs on poll interval. Picks URLs from the scan bucket (no GSC signals)."
    : config.conditions.length === 0
      ? "Select at least one condition."
      : null;

  const sourcesField = (
    <Select
      value={activeSource}
      onValueChange={(v) => handleSourceChange(v as TaskTriggerSource)}
      disabled={disabled}
    >
      <SelectTrigger className={TASK_FORM_SELECT_TRIGGER_CLASS}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={TASK_FORM_SELECT_CONTENT_CLASS}>
        {sourceSelectOptions.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className={TASK_FORM_SELECT_ITEM_CLASS}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const matchField = (
    <Select
      value={config.match}
      onValueChange={(v) => patchConfig({ match: v as TaskTriggerConfig["match"] })}
      disabled={disabled}
    >
      <SelectTrigger className={TASK_FORM_SELECT_TRIGGER_CLASS}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={TASK_FORM_SELECT_CONTENT_CLASS}>
        <SelectItem value="any" className={TASK_FORM_SELECT_ITEM_CLASS}>
          Any condition
        </SelectItem>
        <SelectItem value="all" className={TASK_FORM_SELECT_ITEM_CLASS}>
          All conditions
        </SelectItem>
      </SelectContent>
    </Select>
  );

  const conditionsField = (
    <>
      <div className={cn("flex flex-wrap gap-1", inline && "max-w-full")}>
        {TASK_TRIGGER_SIGNALS.map((signal) => {
          const active = activeSignals.has(signal);
          return (
            <button
              key={signal}
              type="button"
              disabled={disabled}
              onClick={() => patchConfig({ conditions: toggleCondition(config.conditions, signal) })}
              className={cn(
                TRIGGER_PILL_CLASS,
                "whitespace-nowrap",
                active ? "bg-primary text-black" : "bg-zinc-800 text-white hover:bg-zinc-700",
              )}
            >
              {TASK_TRIGGER_SIGNAL_LABELS[signal]}
            </button>
          );
        })}
      </div>
      {config.conditions.length > 0 ? (
        <ul className={cn("flex flex-col gap-1", inline ? "mt-1" : "mt-2")}>
          {config.conditions.map((condition) => (
            <li key={conditionKey(condition)} className="flex flex-wrap items-center gap-2">
              <span className="text-base text-white">{TASK_TRIGGER_SIGNAL_LABELS[condition.signal]}</span>
              <Input
                type="number"
                min={0}
                value={condition.value}
                disabled={disabled}
                aria-label={`${TASK_TRIGGER_SIGNAL_LABELS[condition.signal]} threshold`}
                className={cn(TRIGGER_INLINE_INPUT_CLASS, "w-20")}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  patchConfig({
                    conditions: config.conditions.map((c) =>
                      c.signal === condition.signal ? { ...c, value: Number.isFinite(value) ? value : 0 } : c,
                    ),
                  });
                }}
              />
              <Input
                type="number"
                min={0}
                value={condition.minImpressions ?? TASK_TRIGGER_SIGNAL_DEFAULTS[condition.signal].minImpressions ?? 0}
                disabled={disabled}
                aria-label={`${TASK_TRIGGER_SIGNAL_LABELS[condition.signal]} min impressions`}
                className={cn(TRIGGER_INLINE_INPUT_CLASS, "w-24")}
                onChange={(e) => {
                  const minImpressions = Number(e.target.value);
                  patchConfig({
                    conditions: config.conditions.map((c) =>
                      c.signal === condition.signal
                        ? {
                            ...c,
                            minImpressions: Number.isFinite(minImpressions) ? minImpressions : 0,
                          }
                        : c,
                    ),
                  });
                }}
              />
              <span className="whitespace-normal text-base text-muted-foreground">min impressions</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn("text-base text-muted-foreground", inline ? "mt-0" : "mt-1")}>
          Select at least one condition.
        </p>
      )}
    </>
  );

  const numericFieldRows: { label: string; value: number; onChange: (value: number) => void }[] =
    scheduleOnly
      ? [
          {
            label: "URL cooldown (hours)",
            value: config.cooldownHours,
            onChange: (value) => patchConfig({ cooldownHours: value }),
          },
        ]
      : [
          {
            label: "Lookback days",
            value: config.lookbackDays,
            onChange: (value) => patchConfig({ lookbackDays: value }),
          },
          {
            label: "Compare days",
            value: config.compareDays,
            onChange: (value) => patchConfig({ compareDays: value }),
          },
          {
            label: "URL cooldown (hours)",
            value: config.cooldownHours,
            onChange: (value) => patchConfig({ cooldownHours: value }),
          },
        ];

  const inlineNumericRows: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    hidden?: boolean;
  }[] = [
    {
      label: "Lookback days",
      value: config.lookbackDays,
      onChange: (value) => patchConfig({ lookbackDays: value }),
      hidden: scheduleOnly,
    },
    {
      label: "Compare days",
      value: config.compareDays,
      onChange: (value) => patchConfig({ compareDays: value }),
      hidden: scheduleOnly,
    },
    {
      label: "URL cooldown (hours)",
      value: config.cooldownHours,
      onChange: (value) => patchConfig({ cooldownHours: value }),
    },
  ];

  if (inline) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-1">
        <TaskFormFlatGrid className="grid-cols-2">
          <TaskFormPlaceholderCell className="min-w-0">
            <Select
              value={activeSource}
              onValueChange={(v) => handleSourceChange(v as TaskTriggerSource)}
              disabled={disabled}
            >
              <SelectTrigger
                className={cn(TASK_FORM_SELECT_TRIGGER_CLASS, TASK_FORM_SELECT_TRIGGER_NOWRAP_CLASS)}
                aria-label="Source"
              >
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent className={TASK_FORM_SELECT_CONTENT_CLASS}>
                {inlineSourceSelectOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className={TASK_FORM_SELECT_ITEM_CLASS}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TaskFormPlaceholderCell>
          <TaskFormFlatSelectPlaceholder
            placeholder="Match"
            value={config.match}
            onChange={(v) => patchConfig({ match: v as TaskTriggerConfig["match"] })}
            disabled={disabled || scheduleOnly}
            options={[
              { value: "any", label: "Any condition" },
              { value: "all", label: "All conditions" },
            ]}
            className={cn("min-w-0", scheduleOnly && "pointer-events-none invisible")}
          />
        </TaskFormFlatGrid>
        {!scheduleOnly ? (
          <TaskFormPlaceholderCell className="flex min-w-0 flex-col gap-1">
            <div className={cn(TRIGGER_ROW_CLASS, "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1")}>
              <span className="shrink-0 text-base text-muted-foreground">Conditions</span>
              {signalsHeaderSecondary ? (
                <span className="min-w-0 whitespace-normal text-base text-muted-foreground">
                  {signalsHeaderSecondary}
                </span>
              ) : null}
            </div>
            <div className={cn(TRIGGER_ROW_CLASS, "flex min-w-0 flex-wrap items-center gap-1")}>
              {TASK_TRIGGER_SIGNALS.map((signal) => {
                const active = activeSignals.has(signal);
                return (
                  <button
                    key={signal}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      patchConfig({ conditions: toggleCondition(config.conditions, signal) })
                    }
                    className={cn(
                      TRIGGER_PILL_CLASS,
                      "whitespace-nowrap",
                      active ? "bg-primary text-black" : "bg-zinc-800 text-white hover:bg-zinc-700",
                    )}
                  >
                    {TASK_TRIGGER_SIGNAL_LABELS[signal]}
                  </button>
                );
              })}
            </div>
            {config.conditions.length > 0 ? (
              <div className="flex flex-col gap-1">
                {config.conditions.map((condition) => (
                  <div
                    key={conditionKey(condition)}
                    className={cn(
                      TRIGGER_ROW_CLASS,
                      "flex min-w-0 flex-wrap items-center gap-2",
                    )}
                  >
                    <span className="min-w-0 whitespace-normal text-base text-white">
                      {TASK_TRIGGER_SIGNAL_LABELS[condition.signal]}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      value={condition.value}
                      disabled={disabled}
                      aria-label={`${TASK_TRIGGER_SIGNAL_LABELS[condition.signal]} threshold`}
                      className={cn(TRIGGER_INLINE_INPUT_CLASS, "w-20 shrink-0")}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        patchConfig({
                          conditions: config.conditions.map((c) =>
                            c.signal === condition.signal
                              ? { ...c, value: Number.isFinite(value) ? value : 0 }
                              : c,
                          ),
                        });
                      }}
                    />
                    <Input
                      type="number"
                      min={0}
                      value={
                        condition.minImpressions ??
                        TASK_TRIGGER_SIGNAL_DEFAULTS[condition.signal].minImpressions ??
                        0
                      }
                      disabled={disabled}
                      aria-label={`${TASK_TRIGGER_SIGNAL_LABELS[condition.signal]} min impressions`}
                      className={cn(TRIGGER_INLINE_INPUT_CLASS, "w-24 shrink-0")}
                      onChange={(e) => {
                        const minImpressions = Number(e.target.value);
                        patchConfig({
                          conditions: config.conditions.map((c) =>
                            c.signal === condition.signal
                              ? {
                                  ...c,
                                  minImpressions: Number.isFinite(minImpressions)
                                    ? minImpressions
                                    : 0,
                                }
                              : c,
                          ),
                        });
                      }}
                    />
                    <span className="whitespace-normal leading-tight text-base text-muted-foreground">
                      min impressions
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </TaskFormPlaceholderCell>
        ) : null}
        <TaskFormFlatGrid className="grid-cols-2 md:grid-cols-4">
          <PollFrequencyField
            pollHours={config.pollHours}
            disabled={disabled}
            onChange={(pollHours) => patchConfig({ pollHours })}
          />
          {inlineNumericRows.map((row) => (
            <TriggerStackedNumericCell
              key={row.label}
              label={row.label}
              value={row.value}
              disabled={disabled}
              hidden={row.hidden}
              onChange={row.onChange}
            />
          ))}
        </TaskFormFlatGrid>
        <TaskExecutionTargetFields
          executionPayload={executionPayload}
          disabled={disabled}
          variant="inlineRow"
          bucketLabel="Scan bucket"
          onChange={onExecutionPayloadChange}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <TaskFormFieldGrid>
        <TaskFormInfield label="Source">{sourcesField}</TaskFormInfield>
        {!scheduleOnly ? <TaskFormInfield label="Match">{matchField}</TaskFormInfield> : null}
      </TaskFormFieldGrid>

      {scheduleOnly ? (
        <p className="text-base text-muted-foreground">
          Runs on poll interval. Picks URLs from the scan bucket (no GSC signals).
        </p>
      ) : (
        <TaskFormInfield label="Conditions">{conditionsField}</TaskFormInfield>
      )}

      {scheduleOnly ? (
        <TaskFormFieldGrid>
          <PollFrequencyField
            pollHours={config.pollHours}
            disabled={disabled}
            onChange={(pollHours) => patchConfig({ pollHours })}
          />
          {numericFieldRows.map((row) => (
            <TaskFormInfield key={row.label} label={row.label}>
              <Input
                type="number"
                min={1}
                value={row.value}
                disabled={disabled}
                className="bg-zinc-900 text-base"
                onChange={(e) => row.onChange(Math.max(1, Number(e.target.value) || row.value))}
              />
            </TaskFormInfield>
          ))}
        </TaskFormFieldGrid>
      ) : (
        <>
          <TaskFormFieldGrid>
            {numericFieldRows.slice(0, 2).map((row) => (
              <TaskFormInfield key={row.label} label={row.label}>
                <Input
                  type="number"
                  min={1}
                  value={row.value}
                  disabled={disabled}
                  className="bg-zinc-900 text-base"
                  onChange={(e) => row.onChange(Math.max(1, Number(e.target.value) || row.value))}
                />
              </TaskFormInfield>
            ))}
          </TaskFormFieldGrid>
          <TaskFormFieldGrid>
            <PollFrequencyField
              pollHours={config.pollHours}
              disabled={disabled}
              onChange={(pollHours) => patchConfig({ pollHours })}
            />
            {numericFieldRows.slice(2).map((row) => (
              <TaskFormInfield key={row.label} label={row.label}>
                <Input
                  type="number"
                  min={1}
                  value={row.value}
                  disabled={disabled}
                  className="bg-zinc-900 text-base"
                  onChange={(e) => row.onChange(Math.max(1, Number(e.target.value) || row.value))}
                />
              </TaskFormInfield>
            ))}
          </TaskFormFieldGrid>
        </>
      )}

      <TaskExecutionTargetFields
        executionPayload={executionPayload}
        disabled={disabled}
        variant="inline"
        bucketLabel="Scan bucket"
        onChange={onExecutionPayloadChange}
      />

      {!scheduleOnly ? (
        <p className="text-base text-muted-foreground">
          GSC data lags about 3 days. Only inventory URLs with impressions in the selected window are evaluated.
        </p>
      ) : null}
    </div>
  );
}

export type TaskTriggerEvaluatePanelProps = {
  evaluating: boolean;
  testFiring: boolean;
  result: TaskTriggerEvaluateResult | null;
  error: string | null;
  disabled?: boolean;
  onEvaluate: () => void;
  onTestFire: () => void;
};

export function TaskTriggerEvaluatePanel({
  evaluating,
  testFiring,
  result,
  error,
  disabled = false,
  onEvaluate,
  onTestFire,
}: TaskTriggerEvaluatePanelProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-10 rounded-none text-base"
          disabled={disabled || evaluating || testFiring}
          onClick={onEvaluate}
        >
          {evaluating ? "Evaluating…" : "Evaluate"}
        </Button>
        <Button
          type="button"
          className="h-10 rounded-none text-base"
          disabled={disabled || evaluating || testFiring}
          onClick={onTestFire}
        >
          {testFiring ? "Queuing…" : "Test trigger (simulated match, live run)"}
        </Button>
      </div>
      {error ? <p className="text-base text-red-400">{error}</p> : null}
      {result?.ok ? (
        <div className="flex flex-col gap-2">
          <p className="text-base text-white">
            Scanned {result.scannedCount ?? 0} URLs · GSC data for {result.gscDataCount ?? 0} ·{" "}
            {result.matchedCount ?? 0} matches
            {result.skippedNoGscData != null ? ` · ${result.skippedNoGscData} skipped (no GSC data)` : null}
          </p>
          {(result.matches ?? []).length > 0 ? (
            <div className="max-h-48 overflow-auto">
              <table className="w-full text-base">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-2">URL</th>
                    <th className="py-1 pr-2">Signal</th>
                    <th className="py-1 pr-2">Current</th>
                    <th className="py-1">Prior</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.matches ?? []).map((row) => (
                    <tr key={row.url} className="align-top text-white">
                      <td className="py-1 pr-2">{row.url}</td>
                      <td className="py-1 pr-2">{TASK_TRIGGER_SIGNAL_LABELS[row.signal]}</td>
                      <td className="py-1 pr-2">
                        imp {row.current.impressions ?? 0}, ctr {(row.current.ctr ?? 0).toFixed(3)}, pos{" "}
                        {(row.current.position ?? 0).toFixed(1)}
                      </td>
                      <td className="py-1">
                        imp {row.prior.impressions ?? 0}, ctr {(row.prior.ctr ?? 0).toFixed(3)}, pos{" "}
                        {(row.prior.position ?? 0).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
