import {
  ILLUSTRATIVE_DEFAULT_H2,
  replaceChecklistItemHeading,
  resolveIllustrativeH2Title,
  stripIllustrativeMarkersFromChecklistItem,
} from "@/lib/content-optimization/illustrative-h2";
import {
  SAP_LOCAL_CONDITIONS_H2,
  SAP_NEXT_STEPS_H2,
  SAP_OPTIONS_FIT_H2,
  SAP_PROBLEM_H2,
  SAP_WHAT_WE_OFFER_H2,
  sapLocalRecommendationHeading,
} from "@/lib/prompt-builders/sap-h2-constants";

/** Pin SAP mandatory H2 titles after checklist LLM output (before blueprint). Index-only — slot 4 is the only illustrative. */
export function pinSapChecklistMandatoryHeadings(entity: string, checklist: string[]): string[] {
  const place = entity.trim();
  if (!place || checklist.length === 0) return checklist;
  const pinnedTitles = [
    SAP_PROBLEM_H2,
    SAP_LOCAL_CONDITIONS_H2,
    SAP_OPTIONS_FIT_H2,
    ILLUSTRATIVE_DEFAULT_H2,
    SAP_WHAT_WE_OFFER_H2,
    sapLocalRecommendationHeading(place),
    SAP_NEXT_STEPS_H2,
  ] as const;

  return checklist.slice(0, pinnedTitles.length).map((item, index) => {
    const row = index === 3 ? item : stripIllustrativeMarkersFromChecklistItem(item);
    return replaceChecklistItemHeading(row, pinnedTitles[index]!);
  });
}

/** Resolve agent title after blueprint sanitize (illustrative + SAP/blog fixed H2s). */
export function pinBlueprintAgentTitle(
  title: string,
  features: unknown[],
  index: number,
  sapEntity?: string,
): string {
  const place = sapEntity?.trim();
  if (place) {
    const pinned = [
      SAP_PROBLEM_H2,
      SAP_LOCAL_CONDITIONS_H2,
      SAP_OPTIONS_FIT_H2,
      ILLUSTRATIVE_DEFAULT_H2,
      SAP_WHAT_WE_OFFER_H2,
      sapLocalRecommendationHeading(place),
      SAP_NEXT_STEPS_H2,
    ] as const;
    if (index >= 0 && index < pinned.length) return pinned[index]!;
    return title.trim();
  }
  const t = title.trim();
  const hasIllustrative = features.some(
    (f) => typeof f === "string" && f.toLowerCase().trim().startsWith("[illustrative]"),
  );
  if (hasIllustrative) {
    return resolveIllustrativeH2Title(t);
  }
  return t;
}
