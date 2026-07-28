/** Parallel batch HTTP calls when enriching inventory (each batch runs GSC in parallel on server). */
export const SITEMAP_OPTIMIZER_GSC_BATCH_CONCURRENCY = 8;

/** URLs per Search Console batch request. */
export const SITEMAP_OPTIMIZER_GSC_BATCH_SIZE = 80;

/** GSC live import: parallel batch requests for traffic-row query enrichment. */
export const SITEMAP_OPTIMIZER_GSC_QUERY_BATCH_CONCURRENCY = 8;

/** URLs per batch when fetching page×query metrics (strict match). */
export const SITEMAP_OPTIMIZER_GSC_QUERY_BATCH_SIZE = 80;

export const SITEMAP_OPTIMIZER_CLUSTER_BATCH_SIZE = 60;

export const SITEMAP_OPTIMIZER_CLUSTER_BATCH_THRESHOLD = 80;

/** URLs per grid tag batch (smaller than cluster batch to avoid truncated JSON). */
export const SITEMAP_OPTIMIZER_GRID_URL_TAG_BATCH_SIZE = 25;

/** Parallel OpenRouter calls during grid URL tagging. */
export const SITEMAP_OPTIMIZER_GRID_URL_TAG_BATCH_CONCURRENCY = 4;

/** OpenRouter max_tokens for grid URL tagging (full tag array per batch). */
export const SITEMAP_OPTIMIZER_GRID_URL_TAG_MAX_TOKENS = 65536;

/** Max clusters per grid blog brief OpenRouter call within one topic tag. */
export const SITEMAP_OPTIMIZER_GRID_BLOG_BRIEF_CLUSTERS_PER_SECTION = 30;

/** Parallel OpenRouter calls during grid merge (one call per topic section). */
export const SITEMAP_OPTIMIZER_GRID_BLOG_BRIEF_SECTION_CONCURRENCY = 4;

export const SITEMAP_OPTIMIZER_MERGE_CONCURRENCY = 3;

/** URLs per standalone refresh batch request. */
export const SITEMAP_OPTIMIZER_STANDALONE_REFRESH_BATCH_SIZE = 25;

export const SITEMAP_OPTIMIZER_STANDALONE_REFRESH_CONCURRENCY = 4;

/** Max retry passes when the model omits postIds from a batch. */
export const SITEMAP_OPTIMIZER_STANDALONE_REFRESH_MAX_RETRIES = 8;

/** OpenRouter max_tokens for standalone refresh batches (full proposals per URL). */
export const SITEMAP_OPTIMIZER_STANDALONE_REFRESH_MAX_TOKENS = 65536;

export const SITEMAP_OPTIMIZER_CONTENT_SNIPPET_MAX = 2000;

export const SITEMAP_OPTIMIZER_MERGE_CONTENT_MAX = 4000;

export const SITEMAP_OPTIMIZER_GSC_TOP_QUERIES = 15;

/** Minimum published posts required to form one merge cluster. */
export const SITEMAP_OPTIMIZER_MIN_MERGE_GROUP_SIZE = 2;

/** Typical target size for one merge cluster (prompt guidance). */
export const SITEMAP_OPTIMIZER_PREFERRED_MAX_MERGE_GROUP_SIZE = 6;

/**
 * Hard ceiling for one consolidated article (rare; near-duplicate sets only).
 */
export const SITEMAP_OPTIMIZER_MAX_MERGE_GROUP_SIZE = 12;

/** Clusters larger than this trigger an automatic tighten/split pass. */
export const SITEMAP_OPTIMIZER_TIGHTEN_CLUSTER_THRESHOLD = 5;

/** Entity SAP: max legacy URLs redirecting into one replacement post (1 post per 5 redirects). */
export const SITEMAP_OPTIMIZER_ENTITY_MAX_REDIRECTS_PER_REPLACEMENT = 5;

/** OpenRouter redirect-plan batch size (full strategy JSON per family). */
export const SITEMAP_OPTIMIZER_ENTITY_REDIRECT_PLAN_BATCH_SIZE = 8;

/** Parallel Compress OpenRouter batches (entity Stage 2). */
export const SITEMAP_OPTIMIZER_ENTITY_COMPRESS_CONCURRENCY = 8;

/** Parallel Transform OpenRouter batches (entity Stage 3). */
export const SITEMAP_OPTIMIZER_ENTITY_TRANSFORM_CONCURRENCY = 8;

export const LEGACY_REDIRECT_MATCH_AGENT_MAX_TOKENS = 65536;

/** URLs per Gemini call (small enough for complete JSON responses). */
export const LEGACY_REDIRECT_MATCH_BATCH_LINE_SIZE = 10;

/** Parallel URL-agent batches (one OpenRouter call per chunk). */
export const LEGACY_REDIRECT_MATCH_BATCH_CONCURRENCY = 8;

/** Max re-asks per chunk before splitting to single-URL agent calls. */
export const LEGACY_REDIRECT_MATCH_CHUNK_MAX_RETRIES = 3;

/** Hard cap on agent calls per chunk (prevents infinite retry loops). */
export const LEGACY_REDIRECT_MATCH_MAX_CHUNK_ATTEMPTS = 12;

/** Legacy redirect results grid rows per page. */
export const LEGACY_REDIRECT_GRID_PAGE_SIZE = 100;
