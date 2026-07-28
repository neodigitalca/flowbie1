/** Shared limits for Local analysis keyword targets (SAP generator panel). */
/** Default total SAP budget for the wand field (user-editable). */
export const LOCAL_ANALYSIS_DEFAULT_SAP_PAGES = 1;
export const LOCAL_ANALYSIS_SAP_MIN = 1;
export const LOCAL_ANALYSIS_SAP_MAX = 50;
export const LOCAL_ANALYSIS_TOTAL_SAP_CAP = 200;

/**
 * Floor for SAP pages per keyword target when using **AI Suggest keywords** (inventory path).
 * Fewer, larger clusters instead of many single-page targets.
 */
export const LOCAL_ANALYSIS_SUGGEST_SAP_MIN_PER_TARGET = 3;

/**
 * Ceiling for required distinct keyword targets (and entity hints when applicable) so the model is never asked for an unrealistic count (e.g. 12).
 */
export const LOCAL_ANALYSIS_SUGGEST_MAX_DISTINCT_TARGETS = 8;
