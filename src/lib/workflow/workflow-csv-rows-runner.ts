import { fetchAgentRunCsvContent } from "@/lib/agent-runs-api";
import type { TaskExecutionKind } from "@/lib/tasks-types";
import { isGridCsvFileRef } from "@/lib/entity-page-creator/resolve-upstream-grid-csv";
import { extractCsvProposedQuestions } from "@/lib/workflow/extract-csv-proposed-questions";
import {
  decodeCsvBase64,
  type WorkflowCsvRowsConfig,
} from "@/lib/workflow/csv-rows-types";
import { linearOrderedNodes } from "@/lib/workflow/workflow-graph-mutations";
import { nodeById, outgoingEdges } from "@/lib/workflow/workflow-graph-utils";
import {
  dfsRowNeedsQuestionExtract,
  mapCsvRecordsToAction,
  type CsvRowsActionMapping,
} from "@/lib/workflow/map-csv-rows-to-action";
import {
  autoCsvColumnMap,
  parseWorkflowCsvRows,
  pickCsvMappedCell,
} from "@/lib/workflow/parse-workflow-csv-rows";
import {
  peekWorkflowCsvRowsMapping,
  peekWorkflowCsvSequential,
  stashWorkflowCsvRowsMapping,
  stashWorkflowCsvSequential,
} from "@/lib/workflow/workflow-csv-rows-stash";
import type {
  WorkflowActionConfig,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowStepOutput,
} from "@/lib/workflow/workflow-types";

export async function loadWorkflowCsvRowsText(input: {
  teamId: number;
  config: WorkflowCsvRowsConfig;
  outputs: WorkflowStepOutput[];
}): Promise<{ csvText: string; fileName: string }> {
  if (input.config.csvInputSource === "workflow") {
    const runScoped = input.outputs.filter((output) => output.scope === "run");
    for (const output of [...runScoped].reverse()) {
      const csvRef = (output.fileRefs ?? []).find((file) => file.url && isGridCsvFileRef(file));
      if (csvRef && output.agentRunId) {
        const content = await fetchAgentRunCsvContent(input.teamId, output.agentRunId);
        if (content?.trim()) {
          return { csvText: content, fileName: csvRef.name || "upstream.csv" };
        }
      }
    }
    throw new Error("Previous step did not produce a CSV.");
  }

  const encoded = input.config.csvBase64?.trim() ?? "";
  if (!encoded) {
    throw new Error("Upload a CSV on the CSV rows step.");
  }
  return {
    csvText: decodeCsvBase64(encoded),
    fileName: input.config.csvFileName?.trim() || "upload.csv",
  };
}

export async function buildCsvRowsActionMapping(input: {
  csvText: string;
  config: WorkflowCsvRowsConfig;
  nextKind: TaskExecutionKind | string;
  useUpstreamContext?: boolean;
}): Promise<CsvRowsActionMapping> {
  const parsed = parseWorkflowCsvRows(input.csvText);
  const columnMap = {
    ...autoCsvColumnMap(parsed.headers),
    ...(input.config.csvColumnMap ?? {}),
  };

  const extractedQuestionsByRow: Record<number, string[]> = {};
  if (input.nextKind === "dfs_llm_article_audit") {
    for (let i = 0; i < parsed.records.length; i += 1) {
      if (!dfsRowNeedsQuestionExtract(parsed.records[i]!, columnMap)) continue;
      extractedQuestionsByRow[i] = await extractCsvProposedQuestions(
        pickCsvMappedCell(parsed.records[i]!, columnMap, "research"),
      );
    }
  }

  return mapCsvRecordsToAction({
    kind: input.nextKind,
    records: parsed.records,
    columnMap,
    csvText: input.csvText,
    useUpstreamContext: input.useUpstreamContext === true,
    extractedQuestionsByRow,
  });
}

export function stashCsvRowsMappingForRun(
  workflowRunId: number,
  mapping: CsvRowsActionMapping,
  nextNode: WorkflowNode,
  nextKind: TaskExecutionKind | string,
): void {
  stashWorkflowCsvRowsMapping(workflowRunId, mapping, nextNode.id);
  if (mapping.mode === "sequential" && mapping.sequentialPayloads?.length) {
    stashWorkflowCsvSequential(workflowRunId, {
      nextNodeId: nextNode.id,
      kind: nextKind,
      payloads: mapping.sequentialPayloads,
      currentIndex: 0,
    });
  }
}

export function findNextActionAgentNode(
  workflow: Pick<WorkflowDefinition, "nodes" | "edges">,
  fromNodeId: string,
): WorkflowNode | undefined {
  const queue = outgoingEdges(workflow.edges, fromNodeId).map((edge) => edge.target);
  const visited = new Set<string>([fromNodeId]);
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (!id || visited.has(id)) continue;
    visited.add(id);
    const node = nodeById(workflow.nodes, id);
    if (!node) continue;
    if (node.kind === "action_agent") return node;
    for (const edge of outgoingEdges(workflow.edges, id)) {
      queue.push(edge.target);
    }
  }
  return undefined;
}

export function findUpstreamCsvRowsNode(
  workflow: Pick<WorkflowDefinition, "nodes" | "edges">,
  actionNodeId: string,
): WorkflowNode | undefined {
  const ordered = linearOrderedNodes(workflow);
  const idx = ordered.findIndex((node) => node.id === actionNodeId);
  if (idx < 0) return undefined;
  for (let i = idx - 1; i >= 0; i -= 1) {
    const node = ordered[i]!;
    if (node.kind === "csv_rows") return node;
    if (node.kind === "action_agent") return undefined;
  }
  return undefined;
}

export function csvRowsStepPreview(mapping: CsvRowsActionMapping): string {
  if (mapping.mode === "sequential") {
    const count = mapping.sequentialPayloads?.length ?? 1;
    const firstUrl = mapping.payload.targetUrl?.trim() || "";
    return firstUrl ? `${count} row${count === 1 ? "" : "s"}. First URL: ${firstUrl}` : `${count} rows`;
  }
  const urls = mapping.payload.targetUrls ?? [];
  const rows = mapping.payload.prefilledImportRows ?? [];
  const count = urls.length || rows.length || 1;
  const firstUrl = urls[0]?.trim() || rows[0]?.destination_url?.trim() || mapping.payload.targetUrl?.trim() || "";
  return firstUrl ? `${count} row${count === 1 ? "" : "s"}. First URL: ${firstUrl}` : `${count} rows`;
}

export async function executeWorkflowCsvRowsStep(input: {
  teamId: number;
  workflowRunId: number;
  workflow: Pick<WorkflowDefinition, "nodes" | "edges">;
  node: WorkflowNode;
  outputs: WorkflowStepOutput[];
}): Promise<{ preview: string; mapping: CsvRowsActionMapping }> {
  const nextNode = findNextActionAgentNode(input.workflow, input.node.id);
  if (!nextNode) {
    throw new Error("CSV rows needs a next action (optimizer, post creator, DFS LLM article audit, entity/SAP, or browser).");
  }
  const nextConfig = (nextNode.config ?? {}) as WorkflowActionConfig;
  const nextKind = String(nextConfig.executionKind ?? "").trim();
  const csvText = (await loadWorkflowCsvRowsText({
    teamId: input.teamId,
    config: (input.node.config ?? {}) as WorkflowCsvRowsConfig,
    outputs: input.outputs,
  })).csvText;
  const mapping = await buildCsvRowsActionMapping({
    csvText,
    config: (input.node.config ?? {}) as WorkflowCsvRowsConfig,
    nextKind,
    useUpstreamContext: nextConfig.executionPayload?.useUpstreamContext === true,
  });
  stashCsvRowsMappingForRun(input.workflowRunId, mapping, nextNode, nextKind);
  return { preview: csvRowsStepPreview(mapping), mapping };
}

export async function ensureWorkflowCsvRowsStashForAction(input: {
  teamId: number;
  workflowRunId: number;
  workflow: Pick<WorkflowDefinition, "nodes" | "edges">;
  actionNode: WorkflowNode;
  outputs: WorkflowStepOutput[];
}): Promise<void> {
  const sequential = peekWorkflowCsvSequential(input.workflowRunId);
  if (sequential?.nextNodeId === input.actionNode.id) return;
  if (peekWorkflowCsvRowsMapping(input.workflowRunId, input.actionNode.id)) return;
  const csvNode = findUpstreamCsvRowsNode(input.workflow, input.actionNode.id);
  if (!csvNode) return;
  await executeWorkflowCsvRowsStep({
    teamId: input.teamId,
    workflowRunId: input.workflowRunId,
    workflow: input.workflow,
    node: csvNode,
    outputs: input.outputs,
  });
}

