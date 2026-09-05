import type { AgentRunResult } from "@/lib/agent-runs-types";
import type { ContentGapCountResult } from "@/lib/content-gap/resolve-content-gap-count";
import { enrichGoogleDriveContractFromSite, normalizeWorkflowDriveContract } from "@/lib/automation-google-drive-delivery";
import { googleDriveClientFolderName, driveFolderDisplayName } from "@/lib/google-drive/google-drive-folder-hierarchy";
import { parseGoogleDriveFolderId } from "@/lib/google-drive/google-drive-folder-presets";
import { testDriveStepUpload } from "@/lib/google-drive/test-drive-step-upload";
import type { WordPressSite } from "@/components/integrations/types";
import type {
  WorkflowActionConfig,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowStepOutput,
} from "@/lib/workflow/workflow-types";
import { isWorkflowClientKind, isWorkflowThenKind, isWorkflowTriggerKind } from "@/lib/workflow/workflow-types";
import { findUpstreamActionAgent } from "@/lib/workflow/workflow-graph-mutations";
import { thenConfig } from "@/lib/workflow/workflow-then-utils";
import {
  decodeCsvBase64,
  type WorkflowCsvRowsConfig,
} from "@/lib/workflow/csv-rows-types";
import { autoCsvColumnMap, parseWorkflowCsvRows, pickCsvMappedCell } from "@/lib/workflow/parse-workflow-csv-rows";

export type WorkflowStepTestRow = {
  label: string;
  value: string;
};

export type WorkflowStepTestResult = {
  nodeId: string;
  ok: boolean;
  summary: string;
  rows?: WorkflowStepTestRow[];
  googleDriveTargetFolderId?: string;
};

export const CONTENT_GAP_STEP_TEST_LABELS = ["Content", "Current", "Target", "Gap"] as const;

export function workflowNodeSupportsStepTest(node: WorkflowNode): boolean {
  if (isWorkflowClientKind(node.kind) || isWorkflowTriggerKind(node.kind)) return false;
  if (node.kind === "action_agent") return true;
  if (node.kind === "csv_rows") return true;
  if (isWorkflowThenKind(node.kind)) return true;
  if (node.kind === "path_rules" || node.kind === "rag_archive") return true;
  return false;
}

export function isContentGapCheckStep(node: WorkflowNode): boolean {
  return (
    node.kind === "action_agent" &&
    (node.config as WorkflowActionConfig).executionKind === "content_gap_check"
  );
}

export function blankContentGapStepTestRows(): WorkflowStepTestRow[] {
  return CONTENT_GAP_STEP_TEST_LABELS.map((label) => ({ label, value: "" }));
}

export function contentGapStepTestRows(gap: ContentGapCountResult): WorkflowStepTestRow[] {
  return [
    { label: "Content", value: gap.contentLabel },
    { label: "Current", value: String(gap.currentCount) },
    { label: "Target", value: String(gap.targetCount) },
    { label: "Gap", value: String(gap.gapCount) },
  ];
}

export function mergeContentGapStepTestRows(resultRows: WorkflowStepTestRow[]): WorkflowStepTestRow[] {
  const byLabel = Object.fromEntries(resultRows.map((row) => [row.label, row.value]));
  return CONTENT_GAP_STEP_TEST_LABELS.map((label) => ({
    label,
    value: byLabel[label]?.trim() ?? "",
  }));
}

export function isGoogleDriveStep(node: WorkflowNode): boolean {
  return node.kind === "then_google_drive";
}

export function testCsvRowsWorkflowStep(node: WorkflowNode): WorkflowStepTestResult {
  if (node.kind !== "csv_rows") {
    return {
      nodeId: node.id,
      ok: false,
      summary: "CSV rows step not found.",
      rows: [{ label: "Result", value: "CSV rows step not found." }],
    };
  }
  const config = (node.config ?? {}) as WorkflowCsvRowsConfig;
  if (config.csvInputSource === "workflow") {
    return {
      nodeId: node.id,
      ok: true,
      summary: "CSV source is the previous step.",
      rows: [
        { label: "Rows", value: "From previous step" },
        { label: "First URL", value: "" },
      ],
    };
  }
  const encoded = config.csvBase64?.trim() ?? "";
  if (!encoded) {
    return {
      nodeId: node.id,
      ok: false,
      summary: "Upload a CSV on the CSV rows step.",
      rows: [{ label: "Result", value: "Upload a CSV on the CSV rows step." }],
    };
  }
  try {
    const parsed = parseWorkflowCsvRows(decodeCsvBase64(encoded));
    const columnMap = { ...autoCsvColumnMap(parsed.headers), ...(config.csvColumnMap ?? {}) };
    const firstUrl = pickCsvMappedCell(parsed.records[0]!, columnMap, "url");
    return {
      nodeId: node.id,
      ok: true,
      summary: `${parsed.records.length} row${parsed.records.length === 1 ? "" : "s"}`,
      rows: [
        { label: "Rows", value: String(parsed.records.length) },
        { label: "First URL", value: firstUrl || "" },
      ],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to parse CSV.";
    return {
      nodeId: node.id,
      ok: false,
      summary: message,
      rows: [{ label: "Result", value: message }],
    };
  }
}

export function resolveGoogleDriveStepTestLink(result?: WorkflowStepTestResult | null): string {
  const folderLink = result?.rows?.find((row) => row.label === "Link")?.value?.trim() ?? "";
  if (folderLink) return folderLink;
  return result?.rows?.find((row) => row.label === "Upload")?.value?.trim() ?? "";
}

export function resolveGoogleDriveStepTestFileLink(result?: WorkflowStepTestResult | null): string {
  return resolveGoogleDriveStepTestLink(result);
}

export function resolveGoogleDriveStepTestLinkLabel(result?: WorkflowStepTestResult | null): string {
  const folderRow = result?.rows?.find((row) => row.label === "Folder")?.value?.trim() ?? "";
  return driveFolderDisplayName(folderRow) || "View folder";
}

function isGoogleDriveMonthLeafLabel(label: string): boolean {
  return /\/ (Reporting|Audits|Grids) \/ \d{4} \/ /i.test(label.trim());
}

function resolveWorkflowDriveExecutionKind(
  workflow: WorkflowDefinition,
  driveNodeId: string,
): string | undefined {
  const agentNode = findUpstreamActionAgent(workflow, driveNodeId);
  if (!agentNode) return undefined;
  const kind = String((agentNode.config as WorkflowActionConfig).executionKind ?? "").trim();
  return kind || undefined;
}

export function humanizeGoogleDriveStepTestMessage(summary: string): string {
  const lines = summary
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^https?:\/\//i.test(line));
  return lines.join(" ").trim();
}

export function googleDriveStepTestRowsFromOutput(
  output?: WorkflowStepOutput | null,
  summary?: string,
): WorkflowStepTestRow[] {
  const folderRef = output?.fileRefs?.find(
    (ref) => ref.mime === "application/vnd.google-apps.folder" || ref.url?.includes("/folders/"),
  );
  const folderLabel = folderRef?.name?.trim() ?? "";
  const folderLink =
    folderRef?.url?.trim() ??
    output?.deliveryMeta?.googleDriveFolderUrl?.trim() ??
    "";
  const created = output?.deliveryMeta?.googleDriveFoldersCreated?.join(" / ") ?? "";
  const preview = output?.textPreview?.trim() || summary?.trim() || "";

  const fileRef = output?.fileRefs?.find(
    (ref) =>
      ref.mime === "application/vnd.google-apps.document" ||
      (ref.url?.includes("/file/d/") && !ref.url.includes("/folders/")),
  );
  const fileLink = fileRef?.url?.trim() ?? output?.deliveryMeta?.googleDriveUrl?.trim() ?? "";
  const fileName = fileRef?.name?.trim() ?? output?.deliveryMeta?.googleDriveFileName?.trim() ?? "";

  const rows: WorkflowStepTestRow[] = [];
  if (folderLabel) rows.push({ label: "Folder", value: folderLabel });
  if (folderLink) rows.push({ label: "Link", value: folderLink });
  if (fileName) rows.push({ label: "File", value: fileName });
  if (fileLink) rows.push({ label: "Upload", value: fileLink });
  if (created) rows.push({ label: "Created", value: created });
  if (rows.length === 0 && preview) rows.push({ label: "Result", value: preview });
  return rows;
}

export function googleDriveStepTestRowsFromUpload(result: {
  fileLink?: string;
  folderLink?: string;
  fileName?: string;
  folderLabel?: string;
  created?: string[];
}): WorkflowStepTestRow[] {
  const rows: WorkflowStepTestRow[] = [];
  const folderLabel = result.folderLabel?.trim() ?? "";
  const folderLink = result.folderLink?.trim() ?? "";
  const fileName = result.fileName?.trim() ?? "";
  const fileLink = result.fileLink?.trim() ?? "";
  const created = result.created?.filter(Boolean).join(" / ") ?? "";
  if (folderLabel) rows.push({ label: "Folder", value: folderLabel });
  if (folderLink) rows.push({ label: "Link", value: folderLink });
  if (fileName) rows.push({ label: "File", value: fileName });
  if (fileLink) rows.push({ label: "Upload", value: fileLink });
  if (created) rows.push({ label: "Created", value: created });
  return rows;
}

export async function testGoogleDriveWorkflowStep(args: {
  workflow: WorkflowDefinition;
  nodeId: string;
  site?: Pick<WordPressSite, "id" | "name" | "siteUrl" | "napInfo"> | null;
}): Promise<WorkflowStepTestResult> {
  const node = args.workflow.nodes.find((item) => item.id === args.nodeId);
  if (node?.kind !== "then_google_drive") {
    return {
      nodeId: args.nodeId,
      ok: false,
      summary: "Google Drive step not found.",
      rows: [{ label: "Result", value: "Google Drive step not found." }],
    };
  }

  const site = args.site;
  if (!site?.id) {
    return {
      nodeId: args.nodeId,
      ok: false,
      summary: "Add a client site to the workflow before testing.",
      rows: [{ label: "Result", value: "Add a client site to the workflow before testing." }],
    };
  }

  const siteName = googleDriveClientFolderName(site);
  const executionKind = resolveWorkflowDriveExecutionKind(args.workflow, args.nodeId);
  const contract = normalizeWorkflowDriveContract(
    enrichGoogleDriveContractFromSite(
      thenConfig(node).executionPayload ?? {},
      siteName,
      site.siteUrl,
    ),
    executionKind,
  );
  const title = args.workflow.name?.trim() || node.label?.trim() || "Workflow step";
  const upload = await testDriveStepUpload({
    title,
    siteName,
    siteUrl: site.siteUrl,
    contract,
    executionKind,
  });

  const folderLink = upload.folderLink?.trim() ?? "";
  if (!upload.ok || !folderLink) {
    const message = upload.error ?? "Google Drive step test failed.";
    return {
      nodeId: args.nodeId,
      ok: false,
      summary: message,
      rows: [{ label: "Result", value: message }],
    };
  }

  const folderLabel = upload.folderLabel?.trim() ?? "";
  if (!isGoogleDriveMonthLeafLabel(folderLabel)) {
    const message = `Google Drive test resolved the client root instead of a month folder (${folderLabel || "unknown path"}).`;
    return {
      nodeId: args.nodeId,
      ok: false,
      summary: message,
      rows: [{ label: "Result", value: message }],
    };
  }

  const rows = googleDriveStepTestRowsFromUpload(upload);
  return {
    nodeId: args.nodeId,
    ok: true,
    summary: folderLink,
    rows,
    googleDriveTargetFolderId: parseGoogleDriveFolderId(folderLink) || undefined,
  };
}

export function resolveWorkflowStepTestRows(
  node: WorkflowNode,
  result?: WorkflowStepTestResult | null,
): WorkflowStepTestRow[] {
  if (!result) return [];

  if (isContentGapCheckStep(node)) {
    if (result.rows?.length) {
      return mergeContentGapStepTestRows(result.rows);
    }
    if (!result.ok && result.summary.trim()) {
      return mergeContentGapStepTestRows([{ label: "Content", value: result.summary }]);
    }
    return blankContentGapStepTestRows();
  }

  if (isGoogleDriveStep(node)) {
    if (resolveGoogleDriveStepTestLink(result)) {
      return [{ label: "Result", value: resolveGoogleDriveStepTestLinkLabel(result) }];
    }
    if (result.rows?.length) {
      const rows = result.rows.filter(
        (row) => row.value.trim().length > 0 && row.label !== "Upload" && row.label !== "Link",
      );
      if (rows.length > 0) return rows;
    }
    const message = humanizeGoogleDriveStepTestMessage(result.summary.trim());
    if (message) return [{ label: "Result", value: message }];
    return [{ label: "Result", value: "" }];
  }

  if (result.rows?.length) return result.rows.filter((row) => row.value.trim().length > 0);
  if (result.summary.trim()) return [{ label: "Result", value: result.summary }];
  return [{ label: "Result", value: "" }];
}

export function formatWorkflowStepTestSummary(
  output?: WorkflowStepOutput | null,
  result?: AgentRunResult | null,
): string {
  if (result?.goalMet === true) {
    const detail = result.message ?? output?.textPreview ?? "";
    return detail ? `Target met. ${detail}` : "Target met.";
  }
  if (typeof result?.gapCount === "number") {
    const detail = result.message ?? output?.textPreview ?? "";
    return detail ? `Gap: ${result.gapCount}. ${detail}` : `Gap: ${result.gapCount}.`;
  }
  const preview = output?.textPreview?.trim() || result?.message?.trim();
  return preview || "Step finished.";
}
