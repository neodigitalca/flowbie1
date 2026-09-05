import React, { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ForgeWhatPublishScheduleFields } from "@/components/manager/tasks/ForgeWhatPublishScheduleFields";
import {
  TASK_FORM_FLAT_CONTROL_CLASS,
  TaskFormFieldGrid,
  TaskFormInfield,
  TaskFormPanel,
} from "@/components/manager/tasks/TaskFormLayout";
import { ensureEntityPageCreatorPayload } from "@/lib/entity-page-creator/entity-page-creator-defaults";
import { entitySapTotalFromParts } from "@/lib/local-analysis/entity-ad-group-budget";
import type { EntityPageCreatorExecutionPayload, TaskExecutionPayload } from "@/lib/tasks-types";

export type EntityGeneratorExecutionFieldsProps = {
  executionPayload?: TaskExecutionPayload | null;
  disabled?: boolean;
  surface?: "default" | "what";
  onChange: (payload: TaskExecutionPayload) => void;
};

export function EntityGeneratorExecutionFields({
  executionPayload,
  disabled = false,
  surface = "default",
  onChange,
}: EntityGeneratorExecutionFieldsProps): React.ReactElement {
  const payload = ensureEntityPageCreatorPayload(executionPayload as EntityPageCreatorExecutionPayload);
  const total = useMemo(
    () => entitySapTotalFromParts(payload.entityAdGroupCount ?? 1, payload.entityAdsPerGroup ?? 1),
    [payload.entityAdGroupCount, payload.entityAdsPerGroup],
  );

  const patch = (partial: Partial<EntityPageCreatorExecutionPayload>) => {
    onChange(ensureEntityPageCreatorPayload({ ...payload, ...partial }));
  };

  return (
    <div className="flex flex-col gap-3">
      <TaskFormPanel title="Entity rows">
        <TaskFormFieldGrid>
          <TaskFormInfield label="Ad groups">
            <Input
              type="number"
              min={1}
              max={15}
              value={payload.entityAdGroupCount ?? 3}
              disabled={disabled}
              className={TASK_FORM_FLAT_CONTROL_CLASS}
              onChange={(e) =>
                patch({ entityAdGroupCount: Math.max(1, Math.min(15, Number(e.target.value) || 1)) })
              }
            />
          </TaskFormInfield>
          <TaskFormInfield label="Locations per ad group">
            <Input
              type="number"
              min={1}
              max={15}
              value={payload.entityAdsPerGroup ?? 5}
              disabled={disabled}
              className={TASK_FORM_FLAT_CONTROL_CLASS}
              onChange={(e) =>
                patch({ entityAdsPerGroup: Math.max(1, Math.min(15, Number(e.target.value) || 1)) })
              }
            />
          </TaskFormInfield>
          <TaskFormInfield label="Total rows">
            <Input value={String(total)} disabled className={TASK_FORM_FLAT_CONTROL_CLASS} readOnly />
          </TaskFormInfield>
          <TaskFormInfield label="Focus keyword">
            <Input
              value={payload.focusKeyword ?? ""}
              disabled={disabled}
              className={TASK_FORM_FLAT_CONTROL_CLASS}
              onChange={(e) => patch({ focusKeyword: e.target.value })}
            />
          </TaskFormInfield>
        </TaskFormFieldGrid>
      </TaskFormPanel>

      <TaskFormPanel title="Title template">
        <Textarea
          value={payload.titleTemplate ?? "{keyword} Near {entity}"}
          disabled={disabled}
          className="min-h-[4rem] resize-y text-base"
          onChange={(e) => patch({ titleTemplate: e.target.value })}
        />
      </TaskFormPanel>

      {surface === "what" ? (
        <ForgeWhatPublishScheduleFields
          payload={payload}
          disabled={disabled}
          onChange={(next) => onChange(ensureEntityPageCreatorPayload({ ...payload, ...next }))}
        />
      ) : null}
    </div>
  );
}
