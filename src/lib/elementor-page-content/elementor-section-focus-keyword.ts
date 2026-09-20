import type { OverviewRow } from "@/components/overview/overview-meta-row-types";

/** Per-section optimize keyword; falls back to section heading, then page focus keyword, then page title. */
export function resolveElementorSectionFocusKeyword(
  row: Pick<OverviewRow, "focusKeyword" | "title" | "elementorSectionKeywords">,
  sectionId: string,
  sectionTitle: string,
): string {
  const fromSection = row.elementorSectionKeywords?.[sectionId]?.trim();
  if (fromSection) return fromSection;
  const fromHeading = sectionTitle.trim();
  if (fromHeading) return fromHeading;
  return row.focusKeyword?.trim() || row.title?.trim() || "";
}

export function patchElementorSectionKeyword(
  row: Pick<OverviewRow, "elementorSectionKeywords">,
  sectionId: string,
  keyword: string,
): Partial<OverviewRow> {
  const trimmed = keyword.trim();
  const prev = row.elementorSectionKeywords ?? {};
  if (!trimmed) {
    if (!(sectionId in prev)) return {};
    const next = { ...prev };
    delete next[sectionId];
    return { elementorSectionKeywords: Object.keys(next).length ? next : undefined };
  }
  if (prev[sectionId] === trimmed) return {};
  return { elementorSectionKeywords: { ...prev, [sectionId]: trimmed } };
}
