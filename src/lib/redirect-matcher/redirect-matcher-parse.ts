import { extractFirstBalancedJsonValue } from "@/lib/competitor-research/competitor-report-json-parse";
import type { RedirectMatcherProposal } from "@/lib/redirect-matcher/types";

function stripMarkdownFence(raw: string): string {
  const t = raw.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fence ? fence[1]!.trim() : t;
}

function normalizeMatches(list: unknown[]): RedirectMatcherProposal[] {
  const out: RedirectMatcherProposal[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const legacyUrl = typeof p.legacyUrl === "string" ? p.legacyUrl.trim() : "";
    const matchedBlogUrl =
      typeof p.matchedBlogUrl === "string" ? p.matchedBlogUrl.trim() : "";
    if (!legacyUrl || !matchedBlogUrl) continue;
    out.push({
      legacyUrl,
      matchedBlogUrl,
      rationale: typeof p.rationale === "string" ? p.rationale.trim() : "",
    });
  }
  return out;
}

export function parseRedirectMatcherAgentBatchJson(content: string): RedirectMatcherProposal[] {
  const trimmed = stripMarkdownFence(content ?? "");
  if (!trimmed) return [];

  const jsonSlice = extractFirstBalancedJsonValue(trimmed) ?? trimmed;
  if (!jsonSlice.trim()) return [];

  try {
    const raw = JSON.parse(jsonSlice) as unknown;
    if (Array.isArray(raw)) {
      return normalizeMatches(raw);
    }
    if (raw && typeof raw === "object") {
      const obj = raw as { matches?: unknown[]; rows?: unknown[] };
      const list = obj.matches ?? obj.rows;
      if (Array.isArray(list)) return normalizeMatches(list);
    }
  } catch {
    return [];
  }
  return [];
}
