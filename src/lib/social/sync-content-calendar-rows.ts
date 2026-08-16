import {
  createIdleContentCalendarRow,
  normalizeContentCalendarRow,
  type ContentCalendarRow,
} from "@/lib/social/content-creator-types";

export function syncContentCalendarRowsToCount(
  rows: ContentCalendarRow[],
  targetCount: number,
): ContentCalendarRow[] {
  const next = rows.map(normalizeContentCalendarRow).slice(0, targetCount);
  while (next.length < targetCount) {
    next.push(createIdleContentCalendarRow());
  }
  return next;
}
