import type { WorkflowStepOutputFileRef } from "@/lib/workflow/workflow-types";

const csvTextByWorkflowRunId = new Map<number, string>();
const fileRefsByWorkflowRunId = new Map<number, WorkflowStepOutputFileRef[]>();
const keywordByWorkflowRunId = new Map<number, string>();

export function stashWorkflowGridCsv(
  workflowRunId: number,
  csvText: string,
  fileRefs: WorkflowStepOutputFileRef[],
  keyword?: string,
): void {
  if (workflowRunId <= 0) return;
  csvTextByWorkflowRunId.set(workflowRunId, csvText);
  fileRefsByWorkflowRunId.set(workflowRunId, fileRefs);
  const kw = keyword?.trim();
  if (kw) keywordByWorkflowRunId.set(workflowRunId, kw);
}

export function peekWorkflowGridCsvText(workflowRunId: number): string | undefined {
  return csvTextByWorkflowRunId.get(workflowRunId);
}

export function takeWorkflowGridCsvText(workflowRunId: number): string | undefined {
  const text = csvTextByWorkflowRunId.get(workflowRunId);
  if (text !== undefined) {
    csvTextByWorkflowRunId.delete(workflowRunId);
  }
  return text;
}

export function peekWorkflowGridKeyword(workflowRunId: number): string | undefined {
  return keywordByWorkflowRunId.get(workflowRunId);
}

export function takeWorkflowGridKeyword(workflowRunId: number): string | undefined {
  const keyword = keywordByWorkflowRunId.get(workflowRunId);
  if (keyword !== undefined) {
    keywordByWorkflowRunId.delete(workflowRunId);
  }
  return keyword;
}

export function peekWorkflowGridFileRefs(workflowRunId: number): WorkflowStepOutputFileRef[] | undefined {
  return fileRefsByWorkflowRunId.get(workflowRunId);
}

export function takeWorkflowGridFileRefs(workflowRunId: number): WorkflowStepOutputFileRef[] | undefined {
  const refs = fileRefsByWorkflowRunId.get(workflowRunId);
  if (refs !== undefined) {
    fileRefsByWorkflowRunId.delete(workflowRunId);
  }
  return refs;
}
