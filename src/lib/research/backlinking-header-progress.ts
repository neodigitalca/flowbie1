import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";

export const BACKLINKING_LABEL = "Backlinking";

export function buildBacklinkingMicroSnapshot(
  busy: boolean,
  statusMessage?: string | null,
): MetaBulkMicroSnapshot | null {
  if (!busy) return null;
  return {
    label: BACKLINKING_LABEL,
    completed: 0,
    total: 1,
    statusMessage: statusMessage?.trim() || "DataForSEO SERP, then OpenRouter…",
  };
}
