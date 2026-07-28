import type { KeywordData, KeywordAIAnalysis } from "@/lib/keyword-types";
import { isNonEnglishKeyword } from "@/lib/gsc-query-processor";

export interface AutoSelectHelpers {
  autoSelectKeywords: (aiAnalysis: KeywordAIAnalysis, keywordsWithVolumeData: KeywordData[]) => string[];
  autoSelectH2Sections: (aiAnalysis: KeywordAIAnalysis) => string[];
  autoSelectPeopleAlsoAsk: (aiAnalysis: KeywordAIAnalysis) => string[];
  autoSelectResearchLinks: (aiAnalysis: KeywordAIAnalysis) => string[];
}

export function getAutoSelectHelpers(): AutoSelectHelpers {
  const autoSelectKeywords = (aiAnalysis: KeywordAIAnalysis, keywordsWithVolumeData: KeywordData[]): string[] => {
    const allAvailableKeywords: string[] = [];
    if (aiAnalysis.keywordSuggestions?.primary) allAvailableKeywords.push(aiAnalysis.keywordSuggestions.primary);
    if (aiAnalysis.keywordSuggestions?.variations) allAvailableKeywords.push(...aiAnalysis.keywordSuggestions.variations);
    if (aiAnalysis.keywordSuggestions?.longTail) allAvailableKeywords.push(...aiAnalysis.keywordSuggestions.longTail);
    if (aiAnalysis.keywordSuggestions?.semantic) allAvailableKeywords.push(...aiAnalysis.keywordSuggestions.semantic);

    const uniqueKeywords = Array.from(new Set(allAvailableKeywords.map((kw) => kw.toLowerCase()))).map(
      (lowerKw) => allAvailableKeywords.find((kw) => kw.toLowerCase() === lowerKw) || lowerKw
    );

    if (uniqueKeywords.length < 5) {
      const keywordDataMap = new Map<string, KeywordData>();
      keywordsWithVolumeData.forEach((kwData) => keywordDataMap.set(kwData.keyword.toLowerCase(), kwData));
      const competitionOrder: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
      return uniqueKeywords.sort((a, b) => {
        const dataA = keywordDataMap.get(a.toLowerCase());
        const dataB = keywordDataMap.get(b.toLowerCase());
        if (dataA && dataB) {
          if (dataA.searchVolume !== dataB.searchVolume) return dataB.searchVolume - dataA.searchVolume;
          if (dataA.difficulty !== dataB.difficulty) return dataA.difficulty - dataB.difficulty;
          return competitionOrder[dataA.competition] - competitionOrder[dataB.competition];
        }
        if (dataA && !dataB) return -1;
        if (dataB && !dataA) return 1;
        return 0;
      });
    }

    const selected: string[] = [];
    if (aiAnalysis.keywordSuggestions?.primary) selected.push(aiAnalysis.keywordSuggestions.primary);
    if (aiAnalysis.keywordSuggestions?.variations) selected.push(...aiAnalysis.keywordSuggestions.variations.slice(0, 5));
    if (aiAnalysis.keywordSuggestions?.longTail) selected.push(...aiAnalysis.keywordSuggestions.longTail.slice(0, 3));
    return [...new Set(selected)];
  };

  const autoSelectH2Sections = (aiAnalysis: KeywordAIAnalysis): string[] => {
    if (!aiAnalysis.h2Suggestions?.length) return [];
    return aiAnalysis.h2Suggestions.slice(0, 7).map((h2) => h2.heading);
  };

  const autoSelectPeopleAlsoAsk = (aiAnalysis: KeywordAIAnalysis): string[] => {
    if (!aiAnalysis.peopleAlsoAsk?.length) return [];
    return aiAnalysis.peopleAlsoAsk.slice(0, 7).map((paa) => (typeof paa === "string" ? paa : paa.question));
  };

  const autoSelectResearchLinks = (aiAnalysis: KeywordAIAnalysis): string[] => {
    if (!aiAnalysis.researchLinks?.length) return [];
    return aiAnalysis.researchLinks.slice(0, 7).map((link) => link.url);
  };

  return {
    autoSelectKeywords,
    autoSelectH2Sections,
    autoSelectPeopleAlsoAsk,
    autoSelectResearchLinks,
  };
}

/**
 * Find related GSC keywords from available queries (semantically similar or from same cluster).
 */
export function findRelatedGSCKeywords(
  primaryKeyword: string,
  gscQueries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }> | undefined,
  clusterKeywords?: string[]
): string[] {
  if (!gscQueries?.length || !Array.isArray(gscQueries)) return [];

  const englishQueries = gscQueries.filter(
    (q) => q.query && typeof q.query === "string" && !isNonEnglishKeyword(q.query)
  );
  const primaryLower = primaryKeyword.toLowerCase().trim();
  const related: string[] = [];
  const seen = new Set<string>([primaryLower]);

  if (clusterKeywords?.length) {
    clusterKeywords.forEach((kw) => {
      const kwLower = kw.toLowerCase().trim();
      if (isNonEnglishKeyword(kw)) return;
      if (kwLower && kwLower !== primaryLower && !seen.has(kwLower)) {
        const existsInGSC = englishQueries.some(
          (q) => q.query && typeof q.query === "string" && q.query.toLowerCase().trim() === kwLower
        );
        if (existsInGSC) {
          related.push(kw.trim());
          seen.add(kwLower);
        }
      }
    });
  }

  const primaryWords = primaryLower.split(/\s+/).filter((w) => w.length > 2);
  englishQueries.forEach((query) => {
    if (!query.query || typeof query.query !== "string") return;
    const queryLower = query.query.toLowerCase().trim();
    if (queryLower === primaryLower || seen.has(queryLower)) return;
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);
    const sharedWords = primaryWords.filter((w) => queryWords.includes(w));
    if (sharedWords.length > 0 && queryWords.length <= 8) {
      related.push(query.query.trim());
      seen.add(queryLower);
    }
  });

  return related
    .filter((kw) => !isNonEnglishKeyword(kw))
    .map((kw) => {
      const gscQuery = englishQueries.find(
        (q) => q.query && typeof q.query === "string" && q.query.toLowerCase().trim() === kw.toLowerCase().trim()
      );
      return { keyword: kw, impressions: gscQuery?.impressions ?? 0, clicks: gscQuery?.clicks ?? 0 };
    })
    .sort((a, b) => (b.clicks !== a.clicks ? b.clicks - a.clicks : b.impressions - a.impressions))
    .slice(0, 10)
    .map((item) => item.keyword);
}
