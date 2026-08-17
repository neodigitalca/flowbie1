import React, { useCallback, useEffect, useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { WordPressScheduleFields } from "@/components/keyword-research/bulk/WordPressScheduleFields";
import { AutomationEmailDeliveryFields } from "@/components/manager/tasks/planner/AutomationEmailDeliveryFields";
import { formatBulkScheduleSummary } from "@/lib/bulk/bulk-schedule-summary";
import {
  ensureExecutionSchedulePayload,
  postCreatorPayloadToScheduleState,
  scheduleStateToExecutionPayload,
  type PostCreatorScheduleUiState,
} from "@/lib/post-creator/post-creator-schedule-payload";
import {
  defaultSchedulePayloadForKind,
  scheduleDestinationModesForKind,
  scheduledDestinationLabelForKind,
  type ScheduleDestinationMode,
} from "@/lib/schedule-output-destination";
import type { TaskExecutionKind, TaskExecutionPayload } from "@/lib/tasks-types";

export type PulseForgePostSchedulePanelProps = {
  executionPayload?: TaskExecutionPayload | null;
  disabled?: boolean;
  heading?: string;
  executionKind?: TaskExecutionKind;
  onChange: (payload: TaskExecutionPayload) => void;
};

function destinationModeFromState(state: PostCreatorScheduleUiState): ScheduleDestinationMode {
  if (state.wordpressDraftOnly) return "draft";
  if (state.automationEmailDelivery) return "email";
  if (state.localArchive) return "local";
  return "scheduled";
}

function destinationModeFromPayload(
  payload: TaskExecutionPayload,
  state: PostCreatorScheduleUiState,
): ScheduleDestinationMode {
  if (payload.sendAutomationEmail === true) return "email";
  return destinationModeFromState(state);
}

function applyDestinationFlags(
  mode: ScheduleDestinationMode,
  state: PostCreatorScheduleUiState,
): PostCreatorScheduleUiState {
  if (mode === "email") {
    return { ...state, automationEmailDelivery: true, localArchive: true, wordpressDraftOnly: false };
  }
  if (mode === "local") {
    return { ...state, automationEmailDelivery: false, localArchive: true, wordpressDraftOnly: false };
  }
  if (mode === "draft") {
    return { ...state, automationEmailDelivery: false, localArchive: false, wordpressDraftOnly: true };
  }
  return { ...state, automationEmailDelivery: false, localArchive: false, wordpressDraftOnly: false };
}

function resolveEmailState(
  state: PostCreatorScheduleUiState,
  base: TaskExecutionPayload,
): PostCreatorScheduleUiState {
  const emailActive =
    base.sendAutomationEmail === true ||
    state.automationEmailDelivery ||
    Boolean(String(base.automationEmailTo ?? "").trim());
  return emailActive ? applyDestinationFlags("email", state) : state;
}

export function PulseForgePostSchedulePanel({
  executionPayload,
  disabled = false,
  heading = "Schedule",
  executionKind,
  onChange,
}: PulseForgePostSchedulePanelProps): React.ReactElement {
  const kindDefaults = useMemo(
    () => defaultSchedulePayloadForKind(executionKind, executionPayload),
    [executionKind, executionPayload],
  );
  const payload = useMemo(() => ensureExecutionSchedulePayload(kindDefaults), [kindDefaults]);
  const state = useMemo(() => postCreatorPayloadToScheduleState(payload), [payload]);
  const destinationMode = useMemo(() => destinationModeFromPayload(payload, state), [payload, state]);
  const showEmailFields =
    payload.sendAutomationEmail === true ||
    state.automationEmailDelivery ||
    Boolean(String(payload.automationEmailTo ?? "").trim());

  const destinationModes = useMemo(
    () => scheduleDestinationModesForKind(executionKind),
    [executionKind],
  );

  useEffect(() => {
    if (executionKind !== "gsc_reporting" && executionKind !== "local_dominator_export") return;
    if (executionPayload?.saveLocalArchive !== undefined) return;
    onChange(defaultSchedulePayloadForKind(executionKind, ensureExecutionSchedulePayload(executionPayload)));
  }, [executionKind, executionPayload, onChange]);

  const pushPayload = useCallback(
    (nextState: PostCreatorScheduleUiState, patch: Partial<TaskExecutionPayload> = {}) => {
      const mergedBase = { ...payload, ...patch };
      const stateForPayload = resolveEmailState(nextState, mergedBase);
      const nextPayload = scheduleStateToExecutionPayload(stateForPayload, mergedBase);
      if (
        mergedBase.sendAutomationEmail === true ||
        stateForPayload.automationEmailDelivery ||
        Boolean(String(mergedBase.automationEmailTo ?? "").trim())
      ) {
        nextPayload.sendAutomationEmail = true;
        nextPayload.saveLocalArchive = true;
      }
      onChange(nextPayload);
    },
    [onChange, payload],
  );

  const commit = useCallback(
    (updater: (prev: PostCreatorScheduleUiState) => PostCreatorScheduleUiState) => {
      pushPayload(updater(state));
    },
    [pushPayload, state],
  );

  const setOutputDestinationMode = useCallback(
    (mode: ScheduleDestinationMode) => {
      const nextState = applyDestinationFlags(mode, state);
      const nextPayload = scheduleStateToExecutionPayload(nextState, payload);
      if (mode === "email") {
        nextPayload.sendAutomationEmail = true;
        nextPayload.saveLocalArchive = true;
      } else if (mode === "local") {
        nextPayload.sendAutomationEmail = false;
        nextPayload.saveLocalArchive = true;
      } else if (mode === "draft") {
        nextPayload.sendAutomationEmail = false;
        nextPayload.saveLocalArchive = false;
      } else {
        nextPayload.sendAutomationEmail = false;
        nextPayload.saveLocalArchive = false;
      }
      onChange(nextPayload);
    },
    [onChange, payload, state],
  );

  const commitEmailFields = useCallback(
    (patch: Partial<TaskExecutionPayload>) => {
      const mergedBase = { ...payload, ...patch };
      const wantsEmail =
        destinationMode === "email" ||
        mergedBase.sendAutomationEmail === true ||
        Boolean(String(mergedBase.automationEmailTo ?? "").trim());
      const nextState = wantsEmail ? applyDestinationFlags("email", state) : state;
      pushPayload(nextState, {
        ...patch,
        ...(wantsEmail ? { sendAutomationEmail: true, saveLocalArchive: true } : {}),
      });
    },
    [destinationMode, payload, pushPayload, state],
  );

  const summary = formatBulkScheduleSummary({
    scheduleFrequency: state.scheduleFrequency,
    customInterval: state.customInterval,
    dayOfWeek: state.dayOfWeek,
    startDateOption: state.startDateOption,
    customStartDate: state.customStartDate,
    startTime: state.startTime,
    draftOnly: state.wordpressDraftOnly,
    emailDelivery: payload.sendAutomationEmail === true || state.automationEmailDelivery,
    localArchive: state.localArchive || state.automationEmailDelivery,
  });

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 px-0.5">
        <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-base font-medium text-white">{heading}</p>
        <p className="ml-auto truncate text-base text-muted-foreground">{summary}</p>
      </div>
      <WordPressScheduleFields
        variant="forge"
        layout="stack"
        scheduleFrequency={state.scheduleFrequency}
        setScheduleFrequency={(scheduleFrequency) => commit((prev) => ({ ...prev, scheduleFrequency }))}
        customInterval={state.customInterval}
        setCustomInterval={(customInterval) => commit((prev) => ({ ...prev, customInterval }))}
        dayOfWeek={state.dayOfWeek}
        setDayOfWeek={(dayOfWeek) => commit((prev) => ({ ...prev, dayOfWeek }))}
        startDateOption={state.startDateOption}
        setStartDateOption={(startDateOption) => commit((prev) => ({ ...prev, startDateOption }))}
        customStartDate={state.customStartDate}
        setCustomStartDate={(customStartDate) =>
          commit((prev) => ({
            ...prev,
            customStartDate:
              typeof customStartDate === "function"
                ? customStartDate(prev.customStartDate)
                : customStartDate,
          }))
        }
        startTime={state.startTime}
        setStartTime={(startTime) => commit((prev) => ({ ...prev, startTime }))}
        useCsvPublishDates={false}
        setUseCsvPublishDates={() => {}}
        wordpressDraftOnly={state.wordpressDraftOnly}
        setWordpressDraftOnly={(wordpressDraftOnly) =>
          commit((prev) => ({ ...prev, wordpressDraftOnly }))
        }
        localArchive={state.localArchive}
        setLocalArchive={(localArchive) => commit((prev) => ({ ...prev, localArchive }))}
        automationEmailDelivery={state.automationEmailDelivery}
        setAutomationEmailDelivery={(automationEmailDelivery) =>
          commit((prev) => ({ ...prev, automationEmailDelivery }))
        }
        destinationModes={destinationModes}
        emailDeliveryEnabled
        scheduledDestinationLabel={scheduledDestinationLabelForKind(executionKind)}
        setOutputDestinationMode={setOutputDestinationMode}
        outputDestinationMode={destinationMode}
        isDisabled={disabled}
      />
      {showEmailFields ? (
        <AutomationEmailDeliveryFields
          payload={payload}
          disabled={disabled}
          onChange={commitEmailFields}
        />
      ) : null}
    </div>
  );
}
