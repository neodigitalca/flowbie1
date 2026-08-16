import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { WordPressScheduleFields } from "@/components/keyword-research/bulk/WordPressScheduleFields";
import { formatBulkScheduleSummary } from "@/lib/bulk/bulk-schedule-summary";
import { ensurePostCreatorPayload } from "@/lib/post-creator/post-creator-defaults";
import {
  postCreatorPayloadToScheduleState,
  scheduleStateToPostCreatorPayload,
  type PostCreatorScheduleUiState,
} from "@/lib/post-creator/post-creator-schedule-payload";
import type { TaskExecutionPayload } from "@/lib/tasks-types";

export type PulseForgePostSchedulePanelProps = {
  executionPayload?: TaskExecutionPayload | null;
  disabled?: boolean;
  onChange: (payload: TaskExecutionPayload) => void;
};

type ScheduleStateUpdater =
  | PostCreatorScheduleUiState
  | ((prev: PostCreatorScheduleUiState) => PostCreatorScheduleUiState);

export function PulseForgePostSchedulePanel({
  executionPayload,
  disabled = false,
  onChange,
}: PulseForgePostSchedulePanelProps): React.ReactElement {
  const base = useMemo(() => ensurePostCreatorPayload(executionPayload), [executionPayload]);
  const derived = useMemo(() => postCreatorPayloadToScheduleState(base), [base]);
  const [state, setState] = useState<PostCreatorScheduleUiState>(derived);

  useEffect(() => {
    setState(derived);
  }, [derived]);

  const commit = useCallback(
    (updater: ScheduleStateUpdater) => {
      setState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        onChange(ensurePostCreatorPayload(scheduleStateToPostCreatorPayload(next, base)));
        return next;
      });
    },
    [base, onChange],
  );

  const summary = formatBulkScheduleSummary({
    scheduleFrequency: state.scheduleFrequency,
    customInterval: state.customInterval,
    dayOfWeek: state.dayOfWeek,
    startDateOption: state.startDateOption,
    customStartDate: state.customStartDate,
    startTime: state.startTime,
    draftOnly: state.wordpressDraftOnly,
  });

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 px-0.5">
        <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-base font-medium text-white">Post schedule</p>
        <p className="ml-auto truncate text-base text-muted-foreground">{summary}</p>
      </div>
      <WordPressScheduleFields
        variant="forge"
        layout="stack"
        scheduleFrequency={state.scheduleFrequency}
        setScheduleFrequency={(scheduleFrequency) =>
          commit((prev) => ({ ...prev, scheduleFrequency }))
        }
        customInterval={state.customInterval}
        setCustomInterval={(customInterval) => commit((prev) => ({ ...prev, customInterval }))}
        dayOfWeek={state.dayOfWeek}
        setDayOfWeek={(dayOfWeek) => commit((prev) => ({ ...prev, dayOfWeek }))}
        startDateOption={state.startDateOption}
        setStartDateOption={(startDateOption) =>
          commit((prev) => ({ ...prev, startDateOption }))
        }
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
        isDisabled={disabled}
      />
    </div>
  );
}
