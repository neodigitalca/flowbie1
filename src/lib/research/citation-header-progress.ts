import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";

export const CITATION_LABEL = "Citation";

export function buildCitationMicroSnapshot(loading: boolean, statusMessage?: string | null): MetaBulkMicroSnapshot | null {
  if (!loading) return null;
  return {
    label: CITATION_LABEL,
    completed: 0,
    total: 1,
    statusMessage: statusMessage?.trim() || "Fetching listings, GBP, SERP, model…",
  };
}
