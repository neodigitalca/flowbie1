import { driveFolderDisplayName } from "@/lib/google-drive/google-drive-folder-hierarchy";
import { workflowClientVariableSuffix } from "@/lib/workflow/workflow-client-config";
import { loadArchiveFilesFromStepOutput } from "@/lib/workflow/workflow-then-deliverable-loader";
import type { TaskArchiveFileInput } from "@/lib/task-execution-archive";
import type { TaskExecutionKind } from "@/lib/tasks-types";
import { clientDeliverableOutputs } from "@/lib/workflow/workflow-rag-client";
import type {
  ThenEmailBatchScope,
  ThenInputMode,
  WorkflowNode,
  WorkflowStepOutput,
  WorkflowStepOutputFileRef,
  WorkflowThenStepConfig,
} from "@/lib/workflow/workflow-types";

export const THEN_EMAIL_MAX_ATTACHMENTS = 5;

export type ThenDriveLinkItem = {
  label: string;
  url: string;
};

export type ResolvedThenConfig = {
  inputVariableKey: string;
  inputNodeId?: string;
  inputMode: ThenInputMode;
  emailBatchScope: ThenEmailBatchScope;
};

export function resolveEffectiveThenConfig(config: WorkflowThenStepConfig): ResolvedThenConfig {
  return {
    inputVariableKey: String(config.inputVariableKey ?? "").trim(),
    inputNodeId: config.inputNodeId,
    inputMode: config.inputMode ?? "single",
    emailBatchScope: config.emailBatchScope ?? "single",
  };
}

function scopeOutputsForSite(
  outputs: WorkflowStepOutput[],
  siteId: string | undefined,
  allSiteIds: string[],
): WorkflowStepOutput[] {
  const targetSiteId = siteId?.trim();
  if (!targetSiteId || allSiteIds.length <= 1) return outputs;
  const suffix = workflowClientVariableSuffix(allSiteIds, targetSiteId);
  return outputs.filter((output) => {
    if (output.siteId?.trim() === targetSiteId) return true;
    if (suffix && output.variableKey.endsWith(suffix)) return true;
    return !allSiteIds.some((id) => {
      if (id === targetSiteId) return false;
      const otherSuffix = workflowClientVariableSuffix(allSiteIds, id);
      return (
        output.siteId?.trim() === id ||
        (otherSuffix.length > 0 && output.variableKey.endsWith(otherSuffix))
      );
    });
  });
}

function pickPreferredUpstreamOutput(candidates: WorkflowStepOutput[]): WorkflowStepOutput | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!;

  const withAgent = candidates.filter((output) => (output.agentRunId ?? 0) > 0);
  if (withAgent.length === 1) return withAgent[0]!;
  if (withAgent.length > 1) {
    return [...withAgent].sort(
      (a, b) => (b.fileRefs?.length ?? 0) - (a.fileRefs?.length ?? 0),
    )[0]!;
  }

  return [...candidates].sort(
    (a, b) => (b.fileRefs?.length ?? 0) - (a.fileRefs?.length ?? 0),
  )[0]!;
}

function resolveSingleUpstreamOutput(
  outputs: WorkflowStepOutput[],
  config: ResolvedThenConfig,
  siteId?: string,
): WorkflowStepOutput | null {
  const scopedSiteId = siteId?.trim();
  const candidates = scopedSiteId
    ? outputs.filter((output) => !output.siteId?.trim() || output.siteId.trim() === scopedSiteId)
    : outputs;

  const key = config.inputVariableKey;
  if (key) {
    const keyed = candidates.filter(
      (output) => output.variableKey === key || output.variableKey.startsWith(`${key}__`),
    );
    if (scopedSiteId && keyed.length > 1) {
      const bySite = keyed.filter((output) => output.siteId?.trim() === scopedSiteId);
      const preferred = pickPreferredUpstreamOutput(bySite.length > 0 ? bySite : keyed);
      if (preferred) return preferred;
    }
    const preferred = pickPreferredUpstreamOutput(keyed);
    if (preferred) return preferred;
  }
  if (config.inputNodeId) {
    const matches = candidates.filter((output) => output.nodeId === config.inputNodeId);
    if (scopedSiteId && matches.length > 1) {
      const bySite = matches.filter((output) => output.siteId?.trim() === scopedSiteId);
      const preferred = pickPreferredUpstreamOutput(bySite.length > 0 ? bySite : matches);
      if (preferred) return preferred;
    }
    const preferred = pickPreferredUpstreamOutput(matches);
    if (preferred) return preferred;
  }
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const output = candidates[index];
    if (output?.agentRunId || (output?.fileRefs?.length ?? 0) > 0) return output;
  }
  return candidates[candidates.length - 1] ?? null;
}

function outputsForNode(
  outputs: WorkflowStepOutput[],
  nodeId: string | undefined,
  variableKey: string,
): WorkflowStepOutput[] {
  if (nodeId) {
    const byNode = outputs.filter((output) => output.nodeId === nodeId);
    if (byNode.length > 0) return byNode;
  }
  if (!variableKey) return [];
  return outputs.filter(
    (output) =>
      output.variableKey === variableKey || output.variableKey.startsWith(`${variableKey}__`),
  );
}

export function resolveThenUpstreamOutputs(
  outputs: WorkflowStepOutput[],
  config: WorkflowThenStepConfig,
  args: {
    siteId?: string;
    allSiteIds?: string[];
    nodes?: WorkflowNode[];
  } = {},
): WorkflowStepOutput[] {
  const resolved = resolveEffectiveThenConfig(config);
  const allSiteIds = args.allSiteIds ?? [];
  const scoped =
    resolved.emailBatchScope === "workflow_run"
      ? outputs
      : scopeOutputsForSite(outputs, args.siteId, allSiteIds);

  if (resolved.inputMode === "single") {
    const single = resolveSingleUpstreamOutput(scoped, resolved, args.siteId);
    return single ? [single] : [];
  }

  if (resolved.inputMode === "all_from_node") {
    const fromNode = outputsForNode(scoped, resolved.inputNodeId, resolved.inputVariableKey);
    if (fromNode.length > 0) return fromNode;
    const single = resolveSingleUpstreamOutput(scoped, resolved, args.siteId);
    return single ? [single] : [];
  }

  if (resolved.inputMode === "all_deliverables" && args.nodes?.length) {
    const siteId = args.siteId?.trim() ?? "";
    const deliverables = clientDeliverableOutputs(scoped, args.nodes, siteId, allSiteIds);
    if (deliverables.length > 0) return deliverables;
  }

  const single = resolveSingleUpstreamOutput(scoped, resolved, args.siteId);
  return single ? [single] : [];
}

function isDriveFileRef(ref: WorkflowStepOutputFileRef): boolean {
  const mime = ref.mime?.trim().toLowerCase() ?? "";
  if (mime.includes("google-apps")) return true;
  const url = ref.url?.trim().toLowerCase() ?? "";
  return url.includes("drive.google.com") || url.includes("docs.google.com");
}

export function collectDriveLinkItems(outputs: WorkflowStepOutput[]): ThenDriveLinkItem[] {
  const seen = new Set<string>();
  const items: ThenDriveLinkItem[] = [];

  const push = (label: string, url: string) => {
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    items.push({ label: label.trim() || trimmed, url: trimmed });
  };

  for (const output of outputs) {
    const meta = output.deliveryMeta;
    if (meta?.googleDriveUrl) {
      push(meta.googleDriveFileName ?? "Report", meta.googleDriveUrl);
    }
    if (meta?.googleDriveFolderUrl) {
      push(driveFolderDisplayName(meta.googleDriveFolderLabel ?? "Folder"), meta.googleDriveFolderUrl);
    } else if (meta?.googleDriveUrl && !meta.googleDriveFileName) {
      push(output.label ?? output.variableKey ?? "Google Drive", meta.googleDriveUrl);
    }
    for (const ref of output.fileRefs ?? []) {
      if (ref.url && isDriveFileRef(ref)) {
        push(ref.name ?? output.label, ref.url);
      }
    }
  }
  return items;
}

export function formatDriveLinksBulletList(items: readonly ThenDriveLinkItem[]): string {
  if (items.length === 0) return "";
  return items.map((item) => `- ${item.label}: ${item.url}`).join("\n");
}

export function collectDeliverableLabels(outputs: WorkflowStepOutput[]): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const output of outputs) {
    for (const ref of output.fileRefs ?? []) {
      const name = ref.name?.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        labels.push(name);
      }
    }
    const driveName = output.deliveryMeta?.googleDriveFileName?.trim();
    if (driveName && !seen.has(driveName)) {
      seen.add(driveName);
      labels.push(driveName);
    }
    const preview = output.textPreview?.trim();
    if (preview && preview.length < 120 && !seen.has(preview)) {
      seen.add(preview);
      labels.push(preview);
    }
  }
  return labels;
}

export async function collectEmailAttachmentsFromOutputs(
  teamId: number,
  outputs: WorkflowStepOutput[],
  executionKind: TaskExecutionKind | undefined,
  siteName: string | undefined,
  pickSingle: (files: TaskArchiveFileInput[]) => TaskArchiveFileInput | null,
): Promise<TaskArchiveFileInput[]> {
  if (outputs.length === 0) return [];

  const allFiles: TaskArchiveFileInput[] = [];
  for (const output of outputs) {
    const files = await loadArchiveFilesFromStepOutput(teamId, output);
    allFiles.push(...files);
  }

  if (allFiles.length === 0) return [];

  if (outputs.length === 1) {
    const picked = pickSingle(allFiles);
    return picked ? [picked] : [];
  }

  if (allFiles.length <= THEN_EMAIL_MAX_ATTACHMENTS) {
    const deduped = new Map<string, TaskArchiveFileInput>();
    for (const file of allFiles) {
      deduped.set(file.fileName, file);
    }
    return [...deduped.values()];
  }

  if (executionKind === "gsc_reporting" && outputs.length === 1) {
    const picked = pickSingle(allFiles);
    return picked ? [picked] : [];
  }

  return [];
}

export function buildAggregatedEmailSummary(
  outputs: WorkflowStepOutput[],
  driveItems: ThenDriveLinkItem[],
): string {
  const previews = outputs
    .map((output) => output.textPreview?.trim())
    .filter((value): value is string => Boolean(value));
  const base = previews[0] ?? "Workflow deliverable";
  const linkBlock = formatDriveLinksBulletList(driveItems);
  if (!linkBlock) return base;
  if (outputs.length <= 1 && base.includes(driveItems[0]?.url ?? "")) return base;
  return `${base}\n\nGoogle Drive links:\n${linkBlock}`;
}

export function workflowRunThenEmailAlreadySent(
  outputs: WorkflowStepOutput[],
  thenNodeId: string,
): boolean {
  return outputs.some(
    (output) =>
      output.nodeId === thenNodeId &&
      output.deliveryMeta?.emailSent === true &&
      !output.siteId?.trim(),
  );
}
