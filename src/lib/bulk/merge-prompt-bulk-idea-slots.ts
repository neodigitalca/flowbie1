import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";

export function openPromptBulkSlotIndices(
  generatedRowCount: number,
  parsedCount: number,
  keepIndices?: number[],
): number[] {
  const all = Array.from({ length: generatedRowCount }, (_, i) => i);
  if (keepIndices && keepIndices.length > 0) {
    const kept = new Set(keepIndices);
    return all.filter((i) => !kept.has(i));
  }
  return all.slice(0, parsedCount);
}

/**
 * Bind generated ideas to grid slots by original index.
 * Never copy a kept row's title onto a newly generated neighbor (off-by-one).
 */
export function mergePromptBulkIdeaSlots(args: {
  parsedRows: CSVRow[];
  generatedRows: CSVRow[];
  slotKeywords: string[];
  slotModifiers: string[];
  keepIndices?: number[];
}): void {
  const openIndices = openPromptBulkSlotIndices(
    args.generatedRows.length,
    args.parsedRows.length,
    args.keepIndices,
  );
  const regenerating = Boolean(args.keepIndices?.length);

  args.parsedRows.forEach((row, i) => {
    const originalIndex = openIndices[i];
    const userKw = args.slotKeywords[i]?.trim();
    if (userKw) row.keyword = userKw;
    const userMod = args.slotModifiers[i]?.trim();
    if (userMod) row.modifier = userMod;
    const slotRow = originalIndex != null ? args.generatedRows[originalIndex] : undefined;
    if (!slotRow) return;
    if (!regenerating && slotRow.title?.trim()) {
      row.title = slotRow.title.trim();
    }
    if (slotRow.meta_description?.trim()) row.meta_description = slotRow.meta_description.trim();
    if (slotRow.entity?.trim()) row.entity = slotRow.entity.trim();
    if (slotRow.target_slug?.trim()) row.target_slug = slotRow.target_slug.trim();
    if (slotRow.modifier_links_json?.trim()) {
      row.modifier_links_json = slotRow.modifier_links_json.trim();
    }
    if (slotRow.publish_date_gmt?.trim()) row.publish_date_gmt = slotRow.publish_date_gmt.trim();
    if (slotRow.featuredImage?.trim()) row.featuredImage = slotRow.featuredImage.trim();
    if (slotRow.wikipedia_url?.trim()) row.wikipedia_url = slotRow.wikipedia_url.trim();
    if (slotRow.wikipedia_title?.trim()) row.wikipedia_title = slotRow.wikipedia_title.trim();
  });
}
