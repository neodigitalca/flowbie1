import { cn } from "@/lib/utils";
import type { SocialCreatorRow } from "@/lib/social/social-creator-types";

export const SOCIAL_CREATOR_PLACEHOLDER_ROW_COUNT = 18;

export function socialCreatorGridRowCount(realAdCount: number): number {
  return Math.max(SOCIAL_CREATOR_PLACEHOLDER_ROW_COUNT, realAdCount);
}

export function buildPpcMetaGridRows(ads: SocialCreatorRow[]): Array<SocialCreatorRow | null> {
  const totalRows = socialCreatorGridRowCount(ads.length);
  return Array.from({ length: totalRows }, (_, index) => ads[index] ?? null);
}

export const PPC_META_ROW_GRID_CLASS = cn(
  "grid w-full min-w-0 min-h-[3rem] grid-cols-[3rem_minmax(0,1.25fr)_minmax(0,0.9fr)_minmax(0,0.75fr)_9rem] items-center gap-x-2 sm:min-h-[3.25rem] sm:gap-x-3",
);

export const PPC_META_ROW_FIELD_CELL =
  "flex min-w-0 w-full items-center border-0 bg-transparent px-0 py-0";

/** Expanded header body spans cols 2–5 so actions land in col 6 with compact rows. */
export const PPC_META_ROW_CONTENT_SPAN_CLASS =
  "col-start-2 col-span-3 flex min-w-0 items-center gap-2 pl-[5px]";
