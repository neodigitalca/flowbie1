import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { resolveBulkWordPressPostTitle } from "@/lib/bulk/bulk-post-title-agent";

/**
 * Replace Ideas checklist titles with the WordPress title agent.
 * Keyword stays the topic. Title is a fresh headline, never the keyword pasted.
 * Skip a row when the user already typed a title in that slot.
 */
export async function fillPromptBulkIdeaTitlesFromAgent(args: {
  rows: CSVRow[];
  apiKey: string;
  model?: string;
  preservedSlotTitles?: string[];
}): Promise<void> {
  await Promise.all(
    args.rows.map(async (row, i) => {
      if (args.preservedSlotTitles?.[i]?.trim()) return;
      const keyword = row.keyword?.trim() ?? "";
      if (!keyword) return;
      const entityRaw = row.entity?.trim() ?? "";
      const entity = entityRaw && entityRaw !== "N/A" ? entityRaw : undefined;
      row.title = await resolveBulkWordPressPostTitle({
        apiKey: args.apiKey,
        focusKeyword: keyword,
        entity,
        model: args.model,
        candidates: {
          csvTitle: row.title,
        },
      });
    }),
  );
}
