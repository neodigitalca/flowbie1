import { generateCompetitors } from "@/lib/competitor";
import type { CompetitorGridPlaceRow } from "@/lib/competitor-research/local-dominator-grid-parse";
import type { WordPressSite } from "@/components/integrations/types";
import type { GeneratedCompetitorRow } from "../types";

export async function runCompetitorGenerator(args: {
  site: WordPressSite;
  places: CompetitorGridPlaceRow[];
  keyword: string;
  promptModifier?: string;
  apiKey: string;
  model: string;
  siteId?: string;
  onProgress?: (message: string) => void;
}): Promise<{ rows: GeneratedCompetitorRow[]; suggestedTitleFormat: string }> {
  const result = await generateCompetitors(
    {
      site: args.site,
      places: args.places,
      keyword: args.keyword,
      promptModifier: args.promptModifier,
      apiKey: args.apiKey,
      model: args.model,
      siteId: args.siteId,
    },
    (message) => args.onProgress?.(message),
  );

  const rows: GeneratedCompetitorRow[] = result.competitors.map((c) => ({
    ...c.row,
    domain: c.domain,
  }));

  return { rows, suggestedTitleFormat: result.suggestedTitleFormat };
}
