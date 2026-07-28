export interface WikipediaChunk {
  title: string;
  section: string;
  text: string;
  url: string;
  revision_id?: number;
  timestamp?: string;
}

export interface WikipediaFetchOptions {
  summarizeWithAI?: boolean;
  openRouterApiKey?: string;
  onSummarizeProgress?: (message: string) => void;
}

export type EntityHintWikiLookup =
  | { kind: "empty" }
  | { kind: "exact"; title: string; url: string }
  | { kind: "closest"; title: string; url: string; searchedQuery: string }
  /** No verified article matched; optional query used for debugging. */
  | { kind: "none"; searchedQuery?: string };

export interface SapEntityWikiCluster {
  entityHint: string;
  title: string;
  url: string;
  extract: string;
}

export interface ValidatedEntityResult {
  entity: string;
  exists: boolean;
  url?: string;
  title?: string;
}

export interface GetPagesInCategoryOptions {
  limit?: number;
  pageOnly?: boolean;
}

export interface LookupEntityHintWikipediaOptions {
  siteId?: string;
  /**
   * Extra geography tokens (e.g. "United States Florida") from the grid CSV so
   * MediaWiki search prefers articles in the same country/region as the scan.
   */
  wikipediaSearchAugment?: string;
  /**
   * When set (Local analysis granular pool), hint resolution snaps to these titles **first**
   * via `snapEntityHintToWikipediaArticleTitle`, then verifies with MediaWiki exists.
   */
  preferredTitles?: string[];
  /**
   * Order `preferredTitles` by grid weakness weights before snapping (same metro).
   */
  gridPlaceWeights?: ReadonlyArray<{ place: string; weight: number }>;
}
