import type { WordPressSite } from "@/components/integrations/types";
import { normalizeLegacyUrlRows } from "@/lib/redirect-matcher/normalize-legacy-url-rows";
import type { LegacyUrlRow } from "@/lib/redirect-matcher/types";

/** Parse textarea input: one legacy URL per line. */
export function parseLegacyUrlTextInput(
  text: string,
  site: WordPressSite,
): { rows: LegacyUrlRow[]; error?: string } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) {
    return { rows: [], error: "Paste at least one legacy URL." };
  }

  const rows: LegacyUrlRow[] = lines.map((legacyUrl, index) => ({
    legacyUrl,
    uploadRow: index + 1,
  }));

  return normalizeLegacyUrlRows(rows, site);
}
