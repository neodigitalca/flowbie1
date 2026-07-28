export const GOOGLE_ADS_CAMPAIGN_NAME_MAX = 255;
export const GOOGLE_ADS_RSA_HEADLINE_MAX = 30;
export const GOOGLE_ADS_RSA_DESCRIPTION_MAX = 90;
export const GOOGLE_ADS_RSA_DESCRIPTION_COUNT = 4;
export const GOOGLE_ADS_RSA_PATH_MAX = 15;
export const GOOGLE_ADS_KEYWORD_MAX = 80;
export const GOOGLE_ADS_FINAL_URL_MAX = 2048;

export function googleAdsCharCount(value: string): number {
  return [...value].length;
}

export function googleAdsCharCountOver(value: string, max: number): boolean {
  return googleAdsCharCount(value) > max;
}

export const GOOGLE_ADS_GENERATION_COUNT_RULE = `Before you return JSON, count characters for every string you write (spaces and punctuation count).
If any value exceeds its maxLength, rewrite it shorter with complete words and count again until every value is within limit.`;

export const GOOGLE_ADS_RSA_COPY_LIMITS_PROMPT = `${GOOGLE_ADS_GENERATION_COUNT_RULE}
headlines[]: 3 to 5 items, each max ${GOOGLE_ADS_RSA_HEADLINE_MAX} characters. Short punchy phrases.
descriptions[]: exactly ${GOOGLE_ADS_RSA_DESCRIPTION_COUNT} items, each max ${GOOGLE_ADS_RSA_DESCRIPTION_MAX} characters.
path1, path2: optional, each max ${GOOGLE_ADS_RSA_PATH_MAX} characters. Lowercase hyphenated URL slug words only (e.g. "free-consult", "book-now", "in-home"). No camelCase. No run-on words.`;

export const GOOGLE_ADS_CAMPAIGN_PLAN_LIMITS_PROMPT = `${GOOGLE_ADS_GENERATION_COUNT_RULE}
campaignName: max ${GOOGLE_ADS_CAMPAIGN_NAME_MAX} characters. Format: "Search - {focusKeyword}" only. No site name, page bucket, or landing page labels.
adGroups[].name: max ${GOOGLE_ADS_CAMPAIGN_NAME_MAX} characters each.`;

export function formatPpcGoogleCampaignName(
  keyword: string,
  network: "SEARCH" = "SEARCH",
): string {
  const typeLabel = network === "SEARCH" ? "Search" : network;
  const trimmed = keyword.trim();
  if (!trimmed) return typeLabel;
  const name = `${typeLabel} - ${trimmed}`;
  return name.length > GOOGLE_ADS_CAMPAIGN_NAME_MAX ? name.slice(0, GOOGLE_ADS_CAMPAIGN_NAME_MAX) : name;
}

export const GOOGLE_ADS_KEYWORD_LIMITS_PROMPT = `${GOOGLE_ADS_GENERATION_COUNT_RULE}
keywords[]: each max ${GOOGLE_ADS_KEYWORD_MAX} characters.`;
