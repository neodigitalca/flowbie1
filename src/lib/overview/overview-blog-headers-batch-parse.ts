import { parseAssistantJsonObject } from "@/lib/competitor-research/competitor-report-json-parse";
import { normalizeOverviewKeywordUrlKey } from "@/lib/overview/overview-keyword-batch-parse";
import type { BlogHeadersH2Action, BlogHeadersPlanResult } from "@/lib/overview/overview-blog-headers-agent";

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeH2Action(item: unknown): BlogHeadersH2Action | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const action = row.action;
  if (action !== "optimize" && action !== "add") return null;
  const index = typeof row.index === "number" ? row.index : Number(row.index);
  if (!Number.isFinite(index)) return null;
  const proposedText = asTrimmedString(row.proposedText);
  if (!proposedText) return null;
  return {
    action,
    index,
    proposedText,
    rationale: asTrimmedString(row.rationale),
  };
}

function normalizePlanRow(item: unknown): { url: string; plan: BlogHeadersPlanResult } | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const url = asTrimmedString(row.url) || asTrimmedString(row.page);
  if (!url) return null;
  const rawActions = row.h2Actions;
  const h2Actions: BlogHeadersH2Action[] = [];
  if (Array.isArray(rawActions)) {
    for (const action of rawActions) {
      const normalized = normalizeH2Action(action);
      if (normalized) h2Actions.push(normalized);
    }
  }
  return { url, plan: { h2Actions } };
}

function collectResultRows(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const list = obj.results ?? obj.rows ?? obj.items;
  return Array.isArray(list) ? list : [];
}

export function parseBlogHeadersBatchJson(content: string): Map<string, BlogHeadersPlanResult> {
  const out = new Map<string, BlogHeadersPlanResult>();
  if (!content?.trim()) return out;

  const raw = parseAssistantJsonObject(content);
  for (const item of collectResultRows(raw)) {
    const row = normalizePlanRow(item);
    if (!row) continue;
    out.set(normalizeOverviewKeywordUrlKey(row.url), row.plan);
  }
  return out;
}
