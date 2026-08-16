import type {
  AgentPanelRow,
  PlatformDataResearchMeta,
  PlatformDataSliceEntityInput,
  PlatformDataSliceReport,
} from "./types";

type FetchedInventory = {
  inventory?: {
    rows?: Array<{ title?: string; url?: string; slug?: string }>;
  };
};

function entityPath(entity: PlatformDataSliceEntityInput): string {
  if (entity.slug) {
    const slug = String(entity.slug).trim();
    return slug.startsWith("/") ? slug : `/${slug}/`;
  }
  const url = entity.url ? String(entity.url).trim() : "";
  if (!url) return "";
  try {
    return new URL(url).pathname || url;
  } catch {
    return url;
  }
}

function formatEntityTarget(entities: PlatformDataSliceEntityInput[]): { label: string; urls: string[] } {
  const urls = entities.map((e) => (e.url ? String(e.url) : "")).filter(Boolean);
  if (entities.length === 0) {
    return { label: "No entity payload", urls: [] };
  }
  const first = entities[0];
  const title = first.title ? String(first.title).trim() : "Untitled";
  const path = entityPath(first);
  if (entities.length === 1) {
    const line = path ? `${title} · ${path}` : title;
    return { label: line, urls };
  }
  const extra = entities.length - 1;
  const line = path ? `${title} · ${path} · + ${extra} posts` : `${title} · + ${extra} posts`;
  return { label: line, urls };
}

function gscTargetLabel(slice: string, toolIds: string[] | undefined): string {
  const tools = toolIds?.length ? toolIds.join(", ") : "site analytics";
  return `${slice} · ${tools}`;
}

export function resolveAgentTargets(
  report: PlatformDataSliceReport,
  fetchedData: unknown,
  toolIds?: string[],
): { label: string; urls: string[] } {
  const entities = report.input?.entities;
  if (Array.isArray(entities) && entities.length > 0) {
    return formatEntityTarget(entities);
  }

  const slice = report.slice || "";
  if (slice === "context") {
    const input = report.input as { workspace?: { locationSummary?: string }; focus?: string } | undefined;
    const loc = input?.workspace?.locationSummary?.trim() || input?.focus?.trim() || "Workspace tab";
    return { label: loc, urls: [] };
  }

  if (slice.startsWith("gsc_") || slice === "ga_organic") {
    return { label: gscTargetLabel(slice, toolIds), urls: [] };
  }

  const inventory = (fetchedData as FetchedInventory)?.inventory?.rows;
  if (Array.isArray(inventory) && inventory.length > 0) {
    return formatEntityTarget(
      inventory.map((row) => ({
        title: row.title,
        url: row.url,
        slug: row.slug,
      })),
    );
  }

  return { label: slice ? `Slice: ${slice}` : "Research payload", urls: [] };
}

export function resolveLeadTargets(meta: PlatformDataResearchMeta): { label: string; urls: string[] } {
  const fetched = meta.researchArtifacts?.fetchedData as FetchedInventory | undefined;
  const rows = fetched?.inventory?.rows;
  if (Array.isArray(rows) && rows.length > 0) {
    return formatEntityTarget(rows);
  }

  const reports = meta.researchArtifacts?.sliceReports;
  if (Array.isArray(reports)) {
    for (const report of reports) {
      const entities = report.input?.entities;
      if (Array.isArray(entities) && entities.length > 0) {
        return formatEntityTarget(entities);
      }
    }
  }

  if (meta.intentSummary) {
    return { label: meta.intentSummary, urls: [] };
  }
  return { label: "All slice reports", urls: [] };
}

export function buildAgentPanelRows(meta: PlatformDataResearchMeta): AgentPanelRow[] {
  const artifacts = meta.researchArtifacts;
  const rows: AgentPanelRow[] = [];

  if (meta.sliceTeam?.length) {
    for (const agent of meta.sliceTeam) {
      rows.push({
        id: agent.id || agent.slice,
        kind: "slice",
        label: agent.role || agent.slice,
        slice: agent.slice,
        target: meta.intentSummary?.trim() || "Task action specialist",
        downloadName: `${agent.id || agent.slice}-plan.json`,
        downloadPayload: agent,
      });
    }
  }

  if (meta.actionPlanTools?.length) {
    meta.actionPlanTools.forEach((toolCall, index) => {
      rows.push({
        id: `tool-${toolCall.tool || index}`,
        kind: "slice",
        label: toolCall.tool ? `Tool: ${toolCall.tool}` : "Tool call",
        target: meta.actionExecuted ? "Executed in Build" : "Planned (Build to run)",
        downloadName: `${toolCall.tool || "tool"}-${index + 1}.json`,
        downloadPayload: toolCall,
      });
    });
  }

  if (!artifacts) return rows;
  const fetchedData = artifacts.fetchedData;
  const sliceReports = artifacts.sliceReports ?? [];
  const intentLine = meta.intentSummary?.trim() || "";

  for (const report of sliceReports) {
    const { label } = resolveAgentTargets(report, fetchedData, meta.researchedDataToolIds);
    const roleLabel = report.role?.trim() || report.id;
    rows.push({
      id: report.id,
      kind: "slice",
      label: roleLabel,
      slice: report.slice,
      target: report.error ? `${label} · ${report.error}` : label,
      ms: report.ms,
      error: report.error,
      downloadName: `${report.id}-input-output.json`,
      downloadPayload: {
        id: report.id,
        slice: report.slice,
        role: report.role,
        model: report.model,
        ms: report.ms,
        input: report.input,
        output: report.output,
        error: report.error,
        intentSummary: intentLine || undefined,
      },
    });
  }

  if (meta.leadAgentUsed && artifacts.leadSynthesis) {
    const lead = artifacts.leadSynthesis;
    const { label } = resolveLeadTargets(meta);
    rows.push({
      id: "lead_agent",
      kind: "lead",
      label: "Lead synthesis",
      target: label,
      ms: lead.ms,
      downloadName: "lead-synthesis.json",
      downloadPayload: lead,
    });
  }

  return rows;
}

export function researchMetaForStorage(meta: PlatformDataResearchMeta | undefined): PlatformDataResearchMeta | undefined {
  if (!meta?.researchArtifacts) return meta;

  const artifacts = meta.researchArtifacts;
  const fetched = artifacts.fetchedData as FetchedInventory | undefined;
  const slimFetched =
    fetched?.inventory?.rows && Array.isArray(fetched.inventory.rows)
      ? {
          inventory: {
            source: (fetched.inventory as { source?: string }).source,
            count: fetched.inventory.rows.length,
            rows: fetched.inventory.rows.map((row) => ({
              id: (row as { id?: number }).id,
              title: row.title,
              url: row.url,
              slug: row.slug,
            })),
          },
        }
      : artifacts.fetchedData;

  return {
    ...meta,
    researchedDataBlock: undefined,
    researchArtifacts: {
      plan: artifacts.plan,
      fetchedData: slimFetched,
      sliceReports: artifacts.sliceReports,
      leadSynthesis: artifacts.leadSynthesis,
      researchedBlock: undefined,
    },
  };
}

export function hasAgentsPanel(meta: PlatformDataResearchMeta | undefined): boolean {
  if ((meta?.actionPlanTools?.length ?? 0) > 0) return true;
  if ((meta?.sliceTeam?.length ?? 0) > 0 && meta?.leadAgentUsed) return true;
  if (!meta?.researchArtifacts) return false;
  const reports = meta.researchArtifacts.sliceReports?.length ?? 0;
  const lead = meta.leadAgentUsed && meta.researchArtifacts.leadSynthesis ? 1 : 0;
  return reports + lead > 0;
}
