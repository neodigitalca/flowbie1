import type { TaskExecutionPayload } from "@/lib/tasks-types";

/** Stored on tasks/workflows when Local Dominator should open the first grid scan. */
export const LOCAL_DOMINATOR_GRID_KEYWORD_AUTO = "auto";

const LEGACY_TEMPLATE_KEYWORD = "blinds near me";
const LEGACY_TEMPLATE_BUSINESS = "advance blinds & drapery";

export function isLocalDominatorAutoGridKeyword(keyword: string | null | undefined): boolean {
  const trimmed = String(keyword ?? "").trim().toLowerCase();
  return trimmed === "" || trimmed === LOCAL_DOMINATOR_GRID_KEYWORD_AUTO;
}

/** Persist explicit auto so empty keyword survives save/sanitize merges. */
export function normalizeLocalDominatorGridKeywordStored(
  keyword: string | null | undefined,
): string {
  return isLocalDominatorAutoGridKeyword(keyword)
    ? LOCAL_DOMINATOR_GRID_KEYWORD_AUTO
    : String(keyword ?? "").trim();
}

/** Keyword sent to Local Dominator export (auto resolves to no filter). */
export function resolveLocalDominatorExportKeyword(keyword: string | null | undefined): string {
  return isLocalDominatorAutoGridKeyword(keyword) ? "" : String(keyword ?? "").trim();
}

function isLegacyTemplateKeywordLeak(keyword: string, businessName: string): boolean {
  return (
    keyword.trim().toLowerCase() === LEGACY_TEMPLATE_KEYWORD
    && businessName.trim().toLowerCase() !== LEGACY_TEMPLATE_BUSINESS
  );
}

/** Workflow run: node config wins; drop stale template keyword for other businesses. */
export function resolveWorkflowLocalDominatorGridKeyword(
  nodePayload: TaskExecutionPayload | null | undefined,
  mergedKeyword: string | null | undefined,
  businessName: string,
): string {
  const business = businessName.trim();
  const nodeKeyword = nodePayload?.keyword;

  if (nodeKeyword !== undefined && nodeKeyword !== null) {
    const normalized = normalizeLocalDominatorGridKeywordStored(nodeKeyword);
    if (isLegacyTemplateKeywordLeak(normalized, business)) {
      return LOCAL_DOMINATOR_GRID_KEYWORD_AUTO;
    }
    return normalized;
  }

  const merged = String(mergedKeyword ?? "").trim();
  if (isLocalDominatorAutoGridKeyword(merged) || isLegacyTemplateKeywordLeak(merged, business)) {
    return LOCAL_DOMINATOR_GRID_KEYWORD_AUTO;
  }
  if (!merged) return LOCAL_DOMINATOR_GRID_KEYWORD_AUTO;
  return merged;
}
