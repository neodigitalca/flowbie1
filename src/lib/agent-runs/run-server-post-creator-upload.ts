import type { WordPressSite } from "@/components/integrations/types";
import type { AgentConfig } from "@/types/agent-config";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import {
  ensureBulkGenerationWpInventory,
  inventoryRowsToWordPressLinkables,
} from "@/lib/bulk/bulk-generation-wp-inventory";
import {
  completeServerPostCreatorRowUpload,
  fetchAgentRun,
  fetchAgentRunArtifacts,
  patchAgentRun,
  processAgentRun,
  uploadAgentRunArtifact,
} from "@/lib/agent-runs-api";
import { agentRunIsServerExecution } from "@/lib/agent-runs/agent-run-display";
import { resolveAgentRunRecipeKey } from "@/lib/agent-runs/agent-run-navigation";
import type { AgentRun, AgentRunArtifactRecord } from "@/lib/agent-runs-types";
import { uploadPostCreatorRowToWordPress } from "@/lib/post-creator/post-creator-wordpress-upload";
import { postCreatorRowStepKey } from "@/lib/agent-runs/agent-run-step-keys";
import {
  resolveInternalLinkPlaceholdersInMarkdown,
} from "@/lib/content-generation/internal-link-placeholders";
import { generateServerPostCreatorFeaturedImage } from "@/lib/agent-runs/server-post-creator-featured-image";

const uploadsInFlight = new Set<string>();

function flightKey(runId: number, rowIndex: number): string {
  return `${runId}:${rowIndex}`;
}

function parseRowIndexFromStepKey(stepKey?: string): number | null {
  const trimmed = stepKey?.trim() ?? "";
  const dotted = /^post\.(\d+)\./.exec(trimmed);
  if (dotted) {
    const n = Number(dotted[1]);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  const compact = /^post(\d+)/.exec(trimmed);
  if (compact) {
    const n = Number(compact[1]);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  return null;
}

export function serverPostCreatorRowIndexFromStepKey(stepKey?: string): number | null {
  return parseRowIndexFromStepKey(stepKey);
}

function artifactsForRow(
  artifacts: readonly AgentRunArtifactRecord[],
  rowIndex: number,
): AgentRunArtifactRecord[] {
  return artifacts.filter((a) => parseRowIndexFromStepKey(a.stepKey) === rowIndex);
}

function findArtifact(
  rowArtifacts: readonly AgentRunArtifactRecord[],
  pattern: RegExp,
): AgentRunArtifactRecord | undefined {
  return rowArtifacts.find((a) => pattern.test(a.name ?? ""));
}

async function fetchArtifactText(artifact: AgentRunArtifactRecord): Promise<string> {
  if (!artifact.url) return "";
  const res = await fetch(artifact.url);
  if (!res.ok) throw new Error(`Failed to fetch artifact ${artifact.name}`);
  return res.text();
}

function serverCheckpoint(run: AgentRun): Record<string, unknown> {
  const checkpoint = run.result?.checkpoint;
  if (!checkpoint || typeof checkpoint !== "object") return {};
  const server = (checkpoint as { server?: unknown }).server;
  return server && typeof server === "object" ? (server as Record<string, unknown>) : {};
}

function rowCount(run: AgentRun): number {
  const server = serverCheckpoint(run);
  const rows = server.checklistRows;
  if (Array.isArray(rows) && rows.length > 0) return rows.length;
  const contract = run.plan?.clientRunContract;
  if (contract && typeof contract.postCount === "number") return contract.postCount;
  return 1;
}

function rowData(run: AgentRun, rowIndex: number): CSVRow {
  const server = serverCheckpoint(run);
  const rows = server.checklistRows;
  if (Array.isArray(rows) && rows[rowIndex] && typeof rows[rowIndex] === "object") {
    const r = rows[rowIndex] as Record<string, unknown>;
    return {
      keyword: String(r.keyword ?? ""),
      title: String(r.title ?? r.keyword ?? ""),
      entity: String(r.entity ?? ""),
      origin: String(r.origin ?? ""),
    };
  }
  return { keyword: "", title: "" };
}

function serverRunAwaitingClientUpload(run: AgentRun): boolean {
  const server = serverCheckpoint(run);
  const phase = server.intraPhase;
  return phase === "awaiting_client_upload";
}

export async function tickServerPostCreatorRun(
  teamId: number,
  run: AgentRun,
  sites: WordPressSite[],
): Promise<AgentRun | null> {
  if (!agentRunIsServerExecution(run)) return null;
  if (resolveAgentRunRecipeKey(run) !== "post_creator") return null;
  if (run.status !== "running" && run.status !== "queued") return null;

  let latest = run;
  if (!serverRunAwaitingClientUpload(run)) {
    const result = await processAgentRun(teamId, run.id);
    latest = result.ok && result.run ? result.run : run;
    if (!result.ok) {
      const detail = await fetchAgentRun(teamId, run.id);
      if (detail) latest = detail;
    }
  }

  const uploaded = await maybeUploadServerPostCreatorRows(teamId, latest, sites);
  if (uploaded) {
    const afterUpload = await processAgentRun(teamId, run.id);
    return afterUpload.ok && afterUpload.run ? afterUpload.run : uploaded;
  }

  return latest !== run ? latest : null;
}

export async function maybeUploadServerPostCreatorRows(
  teamId: number,
  run: AgentRun,
  sites: WordPressSite[],
): Promise<AgentRun | null> {
  if (!agentRunIsServerExecution(run)) return null;
  if (resolveAgentRunRecipeKey(run) !== "post_creator") return null;
  if (run.status !== "running" && run.status !== "queued") return null;

  if (!serverRunAwaitingClientUpload(run)) return null;

  const server = serverCheckpoint(run);
  const rowIndex = typeof server.rowIndex === "number" ? server.rowIndex : 0;
  const key = flightKey(run.id, rowIndex);
  if (uploadsInFlight.has(key)) return null;

  const siteId = String(run.plan?.clientRunContract?.siteId ?? run.context?.siteId ?? "").trim();
  const site = sites.find((s) => s.id === siteId);
  if (!site) return null;

  const artifacts = await fetchAgentRunArtifacts(teamId, run.id);
  const rowArtifacts = artifactsForRow(artifacts, rowIndex);
  const contentArtifact = findArtifact(rowArtifacts, /^content-.*\.md$/i);
  const blueprintArtifact = findArtifact(rowArtifacts, /^blueprint-/i);
  const wpArtifact = findArtifact(rowArtifacts, /^wordpress-post-/i);
  if (!contentArtifact || !blueprintArtifact || wpArtifact) return null;

  uploadsInFlight.add(key);
  try {
    const inventory = await ensureBulkGenerationWpInventory(site);
    const wordPressPosts = inventory?.rows?.length
      ? inventoryRowsToWordPressLinkables(inventory.rows)
      : [];

    const markdownContent = await fetchArtifactText(contentArtifact);
    const blueprintRaw = await fetchArtifactText(blueprintArtifact);
    const blueprint = JSON.parse(blueprintRaw) as { agents?: AgentConfig[]; purpose?: string };
    const blueprintAgents = Array.isArray(blueprint.agents) ? blueprint.agents : [];

    const resolvedMarkdown = resolveInternalLinkPlaceholdersInMarkdown(markdownContent, {
      siteId: site.id,
      siteUrl: site.siteUrl,
      wordPressPosts,
    });
    if (resolvedMarkdown !== markdownContent) {
      await uploadAgentRunArtifact(teamId, run.id, {
        stepKey: postCreatorRowStepKey(rowIndex, "content"),
        name: contentArtifact.name ?? `content-post-${Date.now()}.md`,
        mime: "text/markdown",
        content: resolvedMarkdown,
      });
    }

    const markdownForUpload = resolvedMarkdown;

    const keywordArtifact = findArtifact(rowArtifacts, /^keyword-research-/i);
    let keywordResearch: Record<string, unknown> | null = null;
    if (keywordArtifact) {
      try {
        keywordResearch = JSON.parse(await fetchArtifactText(keywordArtifact)) as Record<
          string,
          unknown
        >;
      } catch {
        keywordResearch = null;
      }
    }

    const row = rowData(run, rowIndex);
    const featuredImageEnabled = run.plan?.clientRunContract?.featuredImage !== false;
    let featuredImageId: number | undefined;
    const existingImageArtifact = findArtifact(rowArtifacts, /\.(png|jpe?g|webp)$/i);

    if (featuredImageEnabled && !existingImageArtifact) {
      const title = row.title?.trim() || row.keyword?.trim() || "post";
      const blueprintPurpose =
        typeof blueprint.purpose === "string" ? blueprint.purpose : undefined;
      const featured = await generateServerPostCreatorFeaturedImage({
        site,
        title,
        keyword: row.keyword?.trim() || title,
        markdownContent: markdownForUpload,
        blueprintPurpose,
      });
      featuredImageId = featured.featuredImageId;

      await uploadAgentRunArtifact(teamId, run.id, {
        stepKey: postCreatorRowStepKey(rowIndex, "image"),
        name: featured.imageFileName,
        mime: "image/png",
        content: featured.imageBase64,
      });

      const slugPart =
        contentArtifact.name?.match(/^content-([^-]+(?:-[^-]+)*)-/)?.[1] ?? "post";
      const tsPart = contentArtifact.name?.match(/-(\d{14})\.md$/)?.[1] ?? String(Date.now());

      await uploadAgentRunArtifact(teamId, run.id, {
        stepKey: postCreatorRowStepKey(rowIndex, "image"),
        name: `featured-image-checklist-${slugPart}-${tsPart}.json`,
        mime: "application/json",
        content: featured.checklistJson,
      });
    } else if (featuredImageEnabled && existingImageArtifact) {
      const checklistArtifact = findArtifact(rowArtifacts, /^featured-image-checklist-/i);
      if (checklistArtifact) {
        try {
          const doc = JSON.parse(await fetchArtifactText(checklistArtifact)) as { mediaId?: number };
          if (typeof doc.mediaId === "number" && doc.mediaId > 0) {
            featuredImageId = doc.mediaId;
          }
        } catch {
          // generate fresh on next attempt if checklist missing mediaId
        }
      }
    }

    const destination = run.plan?.clientRunContract?.postDestination;
    const upload = await uploadPostCreatorRowToWordPress({
      site,
      row,
      markdownContent: markdownForUpload,
      blueprintAgents,
      wordPressPosts,
      keywordResearch,
      featuredImageId,
      postDestination: destination === "draft" ? "draft" : "wordpress",
    });

    const slugMatch = contentArtifact.name?.match(/^content-([^-]+(?:-[^-]+)*)-/);
    const slugPart = slugMatch?.[1] ?? "post";
    const tsMatch = contentArtifact.name?.match(/-(\d{14})\.md$/);
    const tsPart = tsMatch?.[1] ?? String(Date.now());

    await uploadAgentRunArtifact(teamId, run.id, {
      stepKey: postCreatorRowStepKey(rowIndex, "upload"),
      name: `seo-research-${slugPart}-${tsPart}.json`,
      mime: "application/json",
      content: upload.seoResearchJson,
    });

    await uploadAgentRunArtifact(teamId, run.id, {
      stepKey: postCreatorRowStepKey(rowIndex, "upload"),
      name: `wordpress-post-${slugPart}-${tsPart}.json`,
      mime: "application/json",
      content: upload.wordpressArtifactJson,
    });

    const result = await completeServerPostCreatorRowUpload(teamId, run.id, rowIndex, {
      url: upload.postUrl,
      postId: upload.postId,
      title: upload.title,
    });

    return result.run ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Client upload failed";
    const failed = await patchAgentRun(teamId, run.id, {
      status: "failed",
      errorMessage: message,
      step: { label: message, status: "error", stepKey: "error" },
    });
    return failed.run ?? null;
  } finally {
    uploadsInFlight.delete(key);
  }
}

export async function warmInventoryForServerPostCreatorRun(
  run: AgentRun,
  sites: WordPressSite[],
): Promise<void> {
  if (!agentRunIsServerExecution(run)) return;
  if (resolveAgentRunRecipeKey(run) !== "post_creator") return;
  const siteId = String(run.plan?.clientRunContract?.siteId ?? run.context?.siteId ?? "").trim();
  const site = sites.find((s) => s.id === siteId);
  if (!site) return;
  await ensureBulkGenerationWpInventory(site);
}

export function pendingServerUploadRowIndex(run: AgentRun): number | null {
  if (!serverRunAwaitingClientUpload(run)) return null;
  const server = serverCheckpoint(run);
  return typeof server.rowIndex === "number" ? server.rowIndex : 0;
}

export function serverPostCreatorAwaitingUpload(run: AgentRun): boolean {
  return serverRunAwaitingClientUpload(run);
}

export function serverPostCreatorRowCount(run: AgentRun): number {
  return rowCount(run);
}
