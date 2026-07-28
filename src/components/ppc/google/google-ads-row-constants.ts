import { cn } from "@/lib/utils";
import type { PpcCampaignRow } from "@/lib/ppc/google-ads-types";

/** Fixed grid size; never tied to toolbar Campaigns input. */
export const PPC_GOOGLE_PLACEHOLDER_ROW_COUNT = 18;

export function ppcGoogleGridRowCount(realCampaignCount: number): number {
  return Math.max(PPC_GOOGLE_PLACEHOLDER_ROW_COUNT, realCampaignCount);
}

export function buildPpcGoogleGridRows(campaigns: PpcCampaignRow[]): Array<PpcCampaignRow | null> {
  const totalRows = ppcGoogleGridRowCount(campaigns.length);
  return Array.from({ length: totalRows }, (_, index) => campaigns[index] ?? null);
}

export const PPC_CAMPAIGN_ROW_GRID_CLASS = cn(
  "grid w-full min-w-0 min-h-[3rem] grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,0.85fr)_7rem] items-center gap-x-2 sm:min-h-[3.25rem] sm:gap-x-3",
);

export const PPC_CAMPAIGN_ROW_FIELD_CELL =
  "flex min-w-0 w-full items-center border-0 bg-transparent px-0 py-0";

/** Ad group / accordion header body spans cols 1–3 so actions land in col 4 with campaign rows. */
export const PPC_ROW_CONTENT_SPAN_CLASS = "col-span-3 flex min-w-0 items-center gap-2 pl-[5px]";
