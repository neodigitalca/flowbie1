/** Legacy outer batch size (Research all no longer chunks; kept for reference). */
export const OVERVIEW_RESEARCH_BATCH_SIZE = 100;

/** Max research rows in flight per batch (conservative vs API rate limits). */
export const OVERVIEW_RESEARCH_ROW_CONCURRENCY_MAX = 3;

/** Parallel OpenRouter QFO web audits per row (planner returns up to 4 queries). */
export const LLM_AUDIT_QFO_QUERY_CONCURRENCY = 3;

/** Parallel DataForSEO SERP fetches during factual verification per row. */
export const TOPIC_RESEARCH_VERIFICATION_SERP_CONCURRENCY = 4;

/** Update 0/N counter on every finished row. */
export const OVERVIEW_RESEARCH_PROGRESS_EVERY = 1;
