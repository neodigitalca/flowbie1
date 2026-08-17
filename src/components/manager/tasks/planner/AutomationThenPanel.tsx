import React from "react";
import { PulseForgePostSchedulePanel } from "@/components/manager/tasks/planner/PulseForgePostSchedulePanel";
import { ensureExecutionSchedulePayload } from "@/lib/post-creator/post-creator-schedule-payload";
import type { AutomationActionBlock } from "@/lib/automation-planner-types";

export type AutomationThenPanelProps = {
  action: AutomationActionBlock;
  disabled?: boolean;
  onChange: (patch: Partial<AutomationActionBlock>) => void;
};

export function AutomationThenPanel({
  action,
  disabled = false,
  onChange,
}: AutomationThenPanelProps): React.ReactElement {
  return (
    <div className="rounded-none bg-zinc-900/50 p-4">
      <PulseForgePostSchedulePanel
        heading="Schedule"
        executionKind={action.executionKind}
        executionPayload={ensureExecutionSchedulePayload(action.executionPayload)}
        disabled={disabled}
        onChange={(executionPayload) => onChange({ executionPayload })}
      />
    </div>
  );
}
