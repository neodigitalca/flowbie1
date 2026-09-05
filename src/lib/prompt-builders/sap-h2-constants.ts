import { ILLUSTRATIVE_DEFAULT_H2 } from "@/lib/content-optimization/illustrative-h2";

export const SAP_PROBLEM_H2 = "Sunlight And Privacy Challenges";
export const SAP_LOCAL_CONDITIONS_H2 = "Local Conditions That Change The Job";
export const SAP_OPTIONS_FIT_H2 = "Options That Fit Local Conditions";
export const SAP_WHAT_WE_OFFER_H2 = "What We Offer";
export const SAP_NEXT_STEPS_H2 = "Next Steps";

export function sapLocalRecommendationHeading(entity: string): string {
  const place = entity.trim() || "[Location]";
  return `Our Recommendation for Homeowners in ${place}`;
}

export const SAP_DEFAULT_COMBINED_OUTLINE = [
  SAP_PROBLEM_H2,
  SAP_LOCAL_CONDITIONS_H2,
  SAP_OPTIONS_FIT_H2,
  ILLUSTRATIVE_DEFAULT_H2,
  SAP_WHAT_WE_OFFER_H2,
  "Our Recommendation for Homeowners in this area",
  SAP_NEXT_STEPS_H2,
] as const;

/** H2 hint list for SAP checklist/generate (same pinned spine as template). */
export function sapSelectedH2OutlineTitles(entity: string): string[] {
  const place = entity.trim() || "this area";
  return [
    SAP_PROBLEM_H2,
    SAP_LOCAL_CONDITIONS_H2,
    SAP_OPTIONS_FIT_H2,
    ILLUSTRATIVE_DEFAULT_H2,
    SAP_WHAT_WE_OFFER_H2,
    sapLocalRecommendationHeading(place),
    SAP_NEXT_STEPS_H2,
  ];
}
