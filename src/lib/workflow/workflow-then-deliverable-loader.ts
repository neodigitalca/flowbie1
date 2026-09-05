import { fetchAgentRunArtifacts, fetchAgentRunDeliverableFiles } from "@/lib/agent-runs-api";
import type { TaskArchiveFileInput } from "@/lib/task-execution-archive";
import type { WorkflowStepOutput } from "@/lib/workflow/workflow-types";
import { fetchAppApiText } from "@/lib/proxy-fetch-text";

async function fetchTextFromUrl(url: string): Promise<string> {
  return fetchAppApiText(url);
}

function isDeliverableArtifact(name: string, mime?: string, stepKey?: string): boolean {
  const lower = name.trim().toLowerCase();
  if (!lower || lower.startsWith("browser-preview.")) return false;
  if (lower.startsWith("automation")) return false;
  if (lower.includes("agent-run") && lower.includes("log")) return false;
  if (lower.includes("session-log") || lower.endsWith("-log.json") || lower.endsWith("-log.md")) {
    return false;
  }
  if (
    stepKey === "grid_export" ||
    stepKey === "grid_csv_input" ||
    stepKey === "grid_summary_md" ||
    stepKey === "entity_wiki_picks" ||
    stepKey === "entity_hydrated_rows" ||
    stepKey === "gsc_reporting" ||
    stepKey === "gsc-deliverables" ||
    stepKey === "gscdeliverables" ||
    stepKey === "entity_bulk_csv" ||
    stepKey === "chatgpt_response" ||
    stepKey === "chatgpt_session"
  ) {
    return true;
  }
  if (mime === "text/markdown" || mime === "text/csv" || mime === "application/json") return true;
  return lower.endsWith(".md") || lower.endsWith(".csv") || lower.endsWith(".json");
}

function mimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".json")) return "application/json";
  return "text/plain";
}

async function loadDeliverablesFromAgentRun(
  teamId: number,
  agentRunId: number,
  attempts = 4,
  delayMs = 750,
): Promise<TaskArchiveFileInput[]> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const fromApi = await fetchAgentRunDeliverableFiles(teamId, agentRunId);
    const files = fromApi.filter((file) => file.fileName.trim() && file.content.trim());
    if (files.length > 0) return files;

    const artifacts = await fetchAgentRunArtifacts(teamId, agentRunId);
    const fromArtifacts: TaskArchiveFileInput[] = [];
    for (const artifact of artifacts) {
      if (!isDeliverableArtifact(artifact.name, artifact.mime, artifact.stepKey)) continue;
      if (!artifact.url) continue;
      try {
        const content = await fetchTextFromUrl(artifact.url);
        if (!content.trim()) continue;
        fromArtifacts.push({
          fileName: artifact.name,
          content,
          mime: artifact.mime ?? mimeFromName(artifact.name),
        });
      } catch {
        /* skip unreadable artifact */
      }
    }
    if (fromArtifacts.length > 0) return fromArtifacts;

    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return [];
}

export async function loadArchiveFilesFromStepOutput(
  teamId: number,
  output: WorkflowStepOutput,
  attempts = 4,
): Promise<TaskArchiveFileInput[]> {
  if (output.agentRunId) {
    const fromRun = await loadDeliverablesFromAgentRun(teamId, output.agentRunId, attempts);
    if (fromRun.length > 0) return fromRun;
  }

  const fromRefs: TaskArchiveFileInput[] = [];
  for (const ref of output.fileRefs ?? []) {
    if (!ref.url || !ref.name) continue;
    try {
      const content = await fetchTextFromUrl(ref.url);
      if (!content.trim()) continue;
      fromRefs.push({
        fileName: ref.name,
        content,
        mime: ref.mime ?? mimeFromName(ref.name),
      });
    } catch {
      /* skip */
    }
  }
  return fromRefs;
}

export function resolveUpstreamDriveLink(outputs: WorkflowStepOutput[], variableKey: string): string {
  const direct = outputs.find((output) => output.variableKey === variableKey);
  if (direct?.deliveryMeta?.googleDriveUrl) return direct.deliveryMeta.googleDriveUrl;

  for (let index = outputs.length - 1; index >= 0; index -= 1) {
    const url = outputs[index]?.deliveryMeta?.googleDriveUrl;
    if (url) return url;
  }
  return "";
}
