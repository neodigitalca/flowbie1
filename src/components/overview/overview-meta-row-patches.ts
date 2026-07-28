import { enforceExactFocusKeyword } from "@/hooks/overview/use-overview-ai-optimize";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";

/** Apply normalized focus keyword and mirror single-field blur: enforce meta alignment only. */
export function patchRowForNewFocusKeyword(row: OverviewRow, kw: string): OverviewRow {
  const nextMeta = row.metaDescription
    ? enforceExactFocusKeyword(row.metaDescription, kw)
    : row.metaDescription;
  const nextAiMeta = row.aiMeta ? enforceExactFocusKeyword(row.aiMeta, kw) : row.aiMeta;
  return {
    ...row,
    focusKeyword: kw,
    metaDescription: nextMeta ?? row.metaDescription,
    aiMeta: nextAiMeta ?? row.aiMeta,
  };
}
