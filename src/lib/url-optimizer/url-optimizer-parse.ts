import { extractFirstBalancedJsonValue } from "@/lib/competitor-research/competitor-report-json-parse";
import type { UrlOptimizerAgentProposal } from "@/lib/url-optimizer/types";

function stripMarkdownFence(raw: string): string {
  const t = raw.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fence ? fence[1]!.trim() : t;
}

export function parseUrlOptimizerAgentBatchJson(content: string): UrlOptimizerAgentProposal[] {
  const trimmed = stripMarkdownFence(content ?? "");
  if (!trimmed) return [];

  const jsonSlice = extractFirstBalancedJsonValue(trimmed) ?? trimmed;
  if (!jsonSlice.trim()) return [];

  try {
    const raw = JSON.parse(jsonSlice) as unknown;
    if (Array.isArray(raw)) {
      return normalizeProposals(raw);
    }
    if (raw && typeof raw === "object") {
      const obj = raw as { proposals?: unknown[]; rows?: unknown[] };
      const list = obj.proposals ?? obj.rows;
      if (Array.isArray(list)) return normalizeProposals(list);
    }
  } catch {
    return [];
  }
  return [];
}

function normalizeProposals(list: unknown[]): UrlOptimizerAgentProposal[] {
  const out: UrlOptimizerAgentProposal[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const page = typeof p.page === "string" ? p.page.trim() : "";
    const proposedPrimaryKeyword =
      typeof p.proposedPrimaryKeyword === "string" ? p.proposedPrimaryKeyword.trim() : "";
    if (!page || !proposedPrimaryKeyword) continue;
    out.push({
      page,
      proposedPrimaryKeyword,
      rationale: typeof p.rationale === "string" ? p.rationale.trim() : "",
    });
  }
  return out;
}
