import React, { useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  TASK_FORM_FLAT_CONTROL_CLASS,
  TaskFormFieldGrid,
  TaskFormInfield,
  TaskFormPanel,
} from "@/components/manager/tasks/TaskFormLayout";
import { PulseForgePostSchedulePanel } from "@/components/manager/tasks/planner/PulseForgePostSchedulePanel";
import { ensureEntityPageCreatorPayload } from "@/lib/entity-page-creator/entity-page-creator-defaults";
import { entitySapTotalFromParts } from "@/lib/local-analysis/entity-ad-group-budget";
import type { EntityPageCreatorExecutionPayload, TaskExecutionPayload } from "@/lib/tasks-types";

export type SapGeneratorExecutionFieldsProps = {
  executionPayload?: TaskExecutionPayload | null;
  disabled?: boolean;
  workflowEntityCsvLocked?: boolean;
  onChange: (payload: TaskExecutionPayload) => void;
};

export function SapGeneratorExecutionFields({
  executionPayload,
  disabled = false,
  workflowEntityCsvLocked = false,
  onChange,
}: SapGeneratorExecutionFieldsProps): React.ReactElement {
  const payload = ensureEntityPageCreatorPayload(executionPayload as EntityPageCreatorExecutionPayload);
  const total = useMemo(
    () => entitySapTotalFromParts(payload.entityAdGroupCount ?? 1, payload.entityAdsPerGroup ?? 1),
    [payload.entityAdGroupCount, payload.entityAdsPerGroup],
  );

  const patch = (partial: Partial<EntityPageCreatorExecutionPayload>) => {
    onChange(ensureEntityPageCreatorPayload({ ...payload, ...partial }));
  };

  const handleEntityCsvFile = async (file: File | null) => {
    if (!file) {
      patch({
        entityCsvBase64: undefined,
        entityCsvUrl: undefined,
        entityCsvInputSource: "upload",
      });
      return;
    }
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    patch({
      entityCsvInputSource: "upload",
      entityCsvBase64: btoa(binary),
      entityCsvUrl: undefined,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <TaskFormPanel title="Entity CSV">
        {workflowEntityCsvLocked ? (
          <p className="text-base text-muted-foreground">Entity CSV from upstream Entity Generator.</p>
        ) : (
          <TaskFormFieldGrid>
            <TaskFormInfield label="Entity CSV file">
              <Input
                type="file"
                accept=".csv,text/csv"
                disabled={disabled}
                className={TASK_FORM_FLAT_CONTROL_CLASS}
                onChange={(e) => void handleEntityCsvFile(e.target.files?.[0] ?? null)}
              />
            </TaskFormInfield>
          </TaskFormFieldGrid>
        )}
      </TaskFormPanel>

      <TaskFormPanel title="SAP pages">
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
          <TaskFormInfield label="Total pages">
            <Input value={String(total)} disabled className={TASK_FORM_FLAT_CONTROL_CLASS} readOnly />
          </TaskFormInfield>
        </TaskFormFieldGrid>
      </TaskFormPanel>

      <PulseForgePostSchedulePanel
        executionKind="sap_generator"
        executionPayload={payload}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}
