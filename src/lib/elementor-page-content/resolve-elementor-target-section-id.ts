import type { ElementorSectionHeader } from "@/lib/elementor-page-content/parse-elementor-section-outline";

/** Map cached HTML section ids (html-section-0) to real Elementor band ids after hydrate. */
export function resolveElementorTargetSectionId(
  targetSectionId: string,
  sections: ElementorSectionHeader[],
  options?: { sectionTitle?: string },
): string {
  const id = targetSectionId?.trim();
  if (!id) return targetSectionId;

  if (sections.some((section) => section.id === id)) return id;

  const indexMatch = id.match(/^(?:html-section|cached-h2)-(\d+)$/);
  if (indexMatch) {
    const index = Number(indexMatch[1]);
    const byIndex = sections[index]?.id?.trim();
    if (byIndex) return byIndex;
  }

  const title = options?.sectionTitle?.trim();
  if (title) {
    const normalized = title.toLowerCase();
    const matches = sections.filter(
      (section) => section.title.trim().toLowerCase() === normalized,
    );
    if (matches.length === 1 && matches[0]!.id) return matches[0]!.id;
  }

  return id;
}
