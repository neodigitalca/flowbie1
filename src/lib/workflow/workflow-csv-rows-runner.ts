import { getStoredSites } from "@/components/integrations/storage";
import { fetchAgentRunCsvContent } from "@/lib/agent-runs-api";
import {
  auditUrlsMissingNewTemplate,
  inventoryHtmlForUrl,
  missingTemplateAuditFileName,
  missingTemplateAuditToCsv,
} from "@/lib/content-optimization/missing-new-template";
import { isGridCsvFileRef } from "@/lib/entity-page-creator/resolve-upstream-grid-csv";
import { commitAgentRunDeliverable } from "@/lib/agent-runs/commit-agent-run-deliverable";
import type { AgentRun } from "@/lib/agent-runs-types";
import { persistTaskArchiveFiles } from "@/lib/task-execution-archive";
import { isTaskExecutionTargetBucket, type TaskExecutionTargetBucket } from "@/lib/task-execution-bucket";
import { resolveTaskExecutionBucketInventory } from "@/lib/task-execution-resolve-bucket-urls";
import type { TaskExecutionKind } from "@/lib/tasks-types";
import { extractCsvProposedQuestions } from "@/lib/workflow/extract-csv-proposed-questions";
import {
  decodeCsvBase64,
  isCsvTextPreview,
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

export { isCsvTextPreview };

async function loadSiteInventoryAuditCsv(input: {
  siteId: string;
  config: WorkflowCsvRowsConfig;
}): Promise<{ csvText: string; fileName: string }> {
  const siteId = input.siteId.trim();
  if (!siteId) {
    throw new Error("CSV rows Site inventory needs a Client.");
  }
  const site = getStoredSites().find((item) => item.id === siteId);
  if (!site) {
    throw new Error("CSV rows Site inventory could not find that Client.");
  }
  const bucket = input.config.targetBucket;
  if (!isTaskExecutionTargetBucket(bucket)) {
    throw new Error("Set a target bucket on the CSV rows step.");
  }
  const { urls, snapshot } = await resolveTaskExecutionBucketInventory(
    site,
    bucket,
    undefined,
    { includeContent: true },
  );
  const audit = auditUrlsMissingNewTemplate(urls, (url) =>
    inventoryHtmlForUrl(snapshot, site.siteUrl, url, bucket),
  );
  return {
    csvText: missingTemplateAuditToCsv(audit, input.config.csvHeaders),
    fileName: missingTemplateAuditFileName(bucket),
  };
}

export async function loadWorkflowCsvRowsText(input: {
  teamId: number;
  config: WorkflowCsvRowsConfig;
  outputs: WorkflowStepOutput[];
  siteId?: string;
}): Promise<{ csvText: string; fileName: string }> {
  if (input.config.csvInputSource === "site") {
    return loadSiteInventoryAuditCsv({
      siteId: input.siteId ?? "",
      config: input.config,
    });
  }

  if (input.config.csvInputSource === "workflow") {
    const runScoped = input.outputs.filter((output) => output.scope === "run");
    for (const output of [...runScoped].reverse()) {
      const csvRef = (output.fileRefs ?? []).find((file) => isGridCsvFileRef(file));
      const preview = output.textPreview?.trim() ?? "";
      if (csvRef && isCsvTextPreview(preview)) {
        return { csvText: preview, fileName: csvRef.name || "upstream.csv" };
      }
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
  fileName?: string;
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
    csvFileName: input.fileName,
    useUpstreamContext: input.useUpstreamContext === true,
    extractedQuestionsByRow,
  });
}

export function stashCsvRowsMappingForRun(
  workflowRunId: number,
  mapping: CsvRowsActionMapping,
  nextNode: WorkflowNode,
  nextKind: TaskExecutionKind | string,
  siteId?: string,
): void {
  stashWorkflowCsvRowsMapping(workflowRunId, mapping, nextNode.id, siteId);
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

export function pageAuditCsvFromOutputs(
  outputs: WorkflowStepOutput[],
  csvNodeId?: string,
): { fileName: string; content: string } | null {
  const scoped = csvNodeId ? outputs.filter((output) => output.nodeId === csvNodeId) : outputs;
  for (const output of [...scoped].reverse()) {
    const preview = output.textPreview?.trim() ?? "";
    if (!isCsvTextPreview(preview)) continue;
    const name =
      (output.fileRefs ?? []).find((file) => file.name.toLowerCase().endsWith(".csv"))?.name?.trim()
      || "page-audit.csv";
    return { fileName: name, content: preview };
  }
  return null;
}

export async function persistPageAuditCsvToNextTask(input: {
  teamId: number;
  workflow: Pick<WorkflowDefinition, "nodes" | "edges">;
  csvNodeId: string;
  fileName: string;
  csvText: string;
}): Promise<void> {
  if (!input.csvText.trim()) return;
  const next = findNextActionAgentNode(input.workflow, input.csvNodeId);
  const taskId = Number(
    (next?.config as WorkflowActionConfig & { compiledTaskId?: number })?.compiledTaskId ?? 0,
  );
  if (!taskId) return;
  await persistTaskArchiveFiles(input.teamId, taskId, [
    { fileName: input.fileName, mime: "text/csv", content: input.csvText },
  ]);
}

export async function attachPageAuditCsvToAgentRun(input: {
  agentRun: AgentRun;
  outputs: WorkflowStepOutput[];
  workflow: Pick<WorkflowDefinition, "nodes" | "edges">;
  actionNodeId: string;
  persistToTask?: boolean;
}): Promise<void> {
  const csvNode = findUpstreamCsvRowsNode(input.workflow, input.actionNodeId);
  const csv = pageAuditCsvFromOutputs(input.outputs, csvNode?.id);
  if (!csv) return;
  await commitAgentRunDeliverable({
    run: input.agentRun,
    stepKey: "page_audit_csv",
    stepLabel: "Page audit CSV",
    files: [{ fileName: csv.fileName, mime: "text/csv", content: csv.content }],
    textPreview: csv.fileName,
    saveLocalArchive: input.persistToTask === true,
  });
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
  const urls = mapping.payload.targetUrls;
  const explicitUrls = Array.isArray(urls);
  const rows = mapping.payload.prefilledImportRows ?? [];
  const count = explicitUrls ? urls.length : rows.length || 1;
  const firstUrl = urls?.[0]?.trim() || rows[0]?.destination_url?.trim() || mapping.payload.targetUrl?.trim() || "";
  return firstUrl ? `${count} row${count === 1 ? "" : "s"}. First URL: ${firstUrl}` : `${count} rows`;
}

export async function executeWorkflowCsvRowsStep(input: {
  teamId: number;
  workflowRunId: number;
  workflow: Pick<WorkflowDefinition, "nodes" | "edges">;
  node: WorkflowNode;
  outputs: WorkflowStepOutput[];
  siteId?: string;
}): Promise<{
  preview: string;
  mapping: CsvRowsActionMapping;
  csvText: string;
  fileName: string;
}> {
  const nextNode = findNextActionAgentNode(input.workflow, input.node.id);
  if (!nextNode) {
    throw new Error("CSV rows needs a next action (optimizer, post creator, DFS LLM article audit, entity/SAP, or browser).");
  }
  const nextConfig = (nextNode.config ?? {}) as WorkflowActionConfig;
  const nextKind = String(nextConfig.executionKind ?? "").trim();
  const loaded = await loadWorkflowCsvRowsText({
    teamId: input.teamId,
    config: (input.node.config ?? {}) as WorkflowCsvRowsConfig,
    outputs: input.outputs,
    siteId: input.siteId,
  });
  const mapping = await buildCsvRowsActionMapping({
    csvText: loaded.csvText,
    fileName: loaded.fileName,
    config: (input.node.config ?? {}) as WorkflowCsvRowsConfig,
    nextKind,
    useUpstreamContext: nextConfig.executionPayload?.useUpstreamContext === true,
  });
  stashCsvRowsMappingForRun(input.workflowRunId, mapping, nextNode, nextKind, input.siteId);
  return {
    preview: loaded.csvText,
    mapping,
    csvText: loaded.csvText,
    fileName: loaded.fileName,
  };
}

export async function ensureWorkflowCsvRowsStashForAction(input: {
  teamId: number;
  workflowRunId: number;
  workflow: Pick<WorkflowDefinition, "nodes" | "edges">;
  actionNode: WorkflowNode;
  outputs: WorkflowStepOutput[];
  siteId?: string;
}): Promise<void> {
  const sequential = peekWorkflowCsvSequential(input.workflowRunId);
  if (sequential?.nextNodeId === input.actionNode.id) return;
  if (peekWorkflowCsvRowsMapping(input.workflowRunId, input.actionNode.id, input.siteId)) return;
  const csvNode = findUpstreamCsvRowsNode(input.workflow, input.actionNode.id);
  if (!csvNode) return;
  await executeWorkflowCsvRowsStep({
    teamId: input.teamId,
    workflowRunId: input.workflowRunId,
    workflow: input.workflow,
    node: csvNode,
    outputs: input.outputs,
    siteId: input.siteId,
  });
}

