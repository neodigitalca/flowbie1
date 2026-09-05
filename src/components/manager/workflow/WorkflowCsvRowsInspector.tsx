import React, { useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  TaskFormFlatSelectPlaceholder,
  TaskFormPanel,
  TASK_FORM_FLAT_CONTROL_CLASS,
} from "@/components/manager/tasks/TaskFormLayout";
import {
  WorkflowInspectorField,
  WorkflowInspectorFieldGrid,
  WorkflowInspectorGroup,
} from "@/components/manager/workflow/WorkflowInspectorLayout";
import { WORKFLOW_FORM_FLAT_CONTROL_CLASS } from "@/components/manager/workflow/forge-workflow-styles";
import {
  CSV_ROWS_COLUMN_FIELDS,
  decodeCsvBase64,
  defaultCsvRowsConfig,
  encodeCsvUtf8ToBase64,
  type CsvRowsColumnField,
  type WorkflowCsvRowsConfig,
} from "@/lib/workflow/csv-rows-types";
import { autoCsvColumnMap, parseWorkflowCsvRows } from "@/lib/workflow/parse-workflow-csv-rows";

const COLUMN_PLACEHOLDERS: Record<CsvRowsColumnField, string> = {
  url: "URL column",
  research: "Research column",
  questions: "Questions column",
  keyword: "Keyword column",
  title: "Title column",
};

export type CsvRowsExecutionFieldsProps = {
  config: WorkflowCsvRowsConfig;
  disabled?: boolean;
  surface?: "inspector" | "what";
  onChange: (config: WorkflowCsvRowsConfig) => void;
};

function headersFromConfig(config: WorkflowCsvRowsConfig): string[] {
  if (config.csvHeaders?.length) return config.csvHeaders;
  const mapped = Object.values(config.csvColumnMap ?? {}).filter(Boolean) as string[];
  return [...new Set(mapped)];
}

export function CsvRowsExecutionFields({
  config,
  disabled = false,
  surface = "inspector",
  onChange,
}: CsvRowsExecutionFieldsProps): React.ReactElement {
  const merged = { ...defaultCsvRowsConfig(), ...config };
  const source = merged.csvInputSource === "workflow" ? "workflow" : "upload";
  const columnMap = merged.csvColumnMap ?? {};
  const headers = headersFromConfig(merged);
  const headerOptions = headers.map((header) => ({ value: header, label: header }));

  const rowCount = useMemo(() => {
    if (source === "workflow") return null;
    if (!merged.csvBase64?.trim()) return 0;
    try {
      const text = decodeCsvBase64(merged.csvBase64.trim());
      return parseWorkflowCsvRows(text).records.length;
    } catch {
      return 0;
    }
  }, [merged.csvBase64, source]);

  const patch = (partial: Partial<WorkflowCsvRowsConfig>) => {
    onChange({ ...merged, ...partial });
  };

  const handleFile = async (file: File | null) => {
    if (!file) {
      patch({ csvBase64: undefined, csvFileName: undefined, csvHeaders: undefined, csvColumnMap: {} });
      return;
    }
    const text = await file.text();
    const parsed = parseWorkflowCsvRows(text);
    patch({
      csvInputSource: "upload",
      csvBase64: encodeCsvUtf8ToBase64(text),
      csvFileName: file.name,
      csvHeaders: parsed.headers,
      csvColumnMap: autoCsvColumnMap(parsed.headers),
    });
  };

  const fileWell = (
    <Input
      type="file"
      accept=".csv,text/csv"
      disabled={disabled || source === "workflow"}
      aria-label="CSV file"
      className={surface === "what" ? TASK_FORM_FLAT_CONTROL_CLASS : WORKFLOW_FORM_FLAT_CONTROL_CLASS}
      onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
    />
  );

  const sourceSelect = (
    <TaskFormFlatSelectPlaceholder
      placeholder="CSV source"
      value={source}
      disabled={disabled}
      onChange={(value) =>
        patch({ csvInputSource: value === "workflow" ? "workflow" : "upload" })
      }
      options={[
        { value: "upload", label: "Upload" },
        { value: "workflow", label: "Previous step CSV" },
      ]}
    />
  );

  const countLabel =
    source === "workflow"
      ? "From previous step"
      : `${rowCount ?? 0} row${rowCount === 1 ? "" : "s"}`;

  const mapFields = CSV_ROWS_COLUMN_FIELDS.map((field) => (
    <TaskFormFlatSelectPlaceholder
      key={field}
      placeholder={COLUMN_PLACEHOLDERS[field]}
      value={columnMap[field] ?? ""}
      disabled={disabled || (source === "upload" && headerOptions.length === 0)}
      onChange={(value) =>
        patch({
          csvColumnMap: { ...columnMap, [field]: value || undefined },
        })
      }
      options={headerOptions}
    />
  ));

  if (surface === "what") {
    return (
      <div className="flex flex-col gap-3">
        <TaskFormPanel title="CSV">
          <div className="grid grid-cols-2 gap-1">
            {sourceSelect}
            {fileWell}
          </div>
          <div className="flex min-h-9 items-center bg-black px-3">
            <span className="text-base tabular-nums text-white">{countLabel}</span>
          </div>
        </TaskFormPanel>
        <TaskFormPanel title="Columns">{mapFields}</TaskFormPanel>
      </div>
    );
  }

  return (
    <>
      <WorkflowInspectorGroup title="CSV">
        <WorkflowInspectorFieldGrid>
          <WorkflowInspectorField>{sourceSelect}</WorkflowInspectorField>
          <WorkflowInspectorField>{fileWell}</WorkflowInspectorField>
        </WorkflowInspectorFieldGrid>
        <div className="flex min-h-9 items-center bg-black px-3">
          <span className="text-base tabular-nums text-white">{countLabel}</span>
        </div>
      </WorkflowInspectorGroup>
      <WorkflowInspectorGroup title="Columns">
        <WorkflowInspectorFieldGrid>{mapFields}</WorkflowInspectorFieldGrid>
      </WorkflowInspectorGroup>
    </>
  );
}

export function WorkflowCsvRowsInspector({
  config,
  disabled,
  onChange,
}: {
  config: WorkflowCsvRowsConfig;
  disabled?: boolean;
  onChange: (config: WorkflowCsvRowsConfig) => void;
}): React.ReactElement {
  return <CsvRowsExecutionFields config={config} disabled={disabled} onChange={onChange} />;
}
