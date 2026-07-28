// Core constants and section generation
export { SYSTEM_PROMPT_CORE, CRITICAL_LINK_RULE, NO_FAKE_TESTIMONIALS_RULE, generateSectionsPrompt, generateSingleSectionPrompt } from "./core";

// System and user prompts (main flow)
export {
  buildSystemPrompt,
  buildUserPrompt,
  buildBulkHarnessSectionUserPrompt,
  BULK_WORDPRESS_POST_TITLE_RULE,
  META_DESCRIPTION_ANTI_CLICKBAIT_RULE,
  TITLE_ANTI_CLICKBAIT_RULE,
  TITLE_CASE_RULE,
  TITLE_KEYWORD_WEAVING_RULE,
  TITLE_WELL_KNOWN_ACRONYMS_RULE,
} from "./system-user";

export { buildOverviewLinkRulesBlock } from "./overview-link-rules";

// Pipeline: planner, draft, reviewer
export { buildPlannerPrompt, buildDraftPrompt, buildReviewerPrompt } from "./pipeline";

// Modification: flow assist, checklist, plan/final/draft/blueprint modification
export {
  buildFlowAssistSystemPrompt,
  buildChecklistGenerationPrompt,
  buildPlanModificationPrompt,
  buildFinalReportModificationPrompt,
  buildDraftReportModificationPrompt,
  buildBlueprintModificationPrompt,
} from "./modification";

// Bulk blog ideas
export {
  buildBulkBlogIdeasSystemPrompt,
  buildBulkBlogIdeasUserPrompt,
  type BulkBlogIdeasContentKind,
  BULK_SERVICE_AREA_GAP_CSV_MODIFIER,
  BULK_SERVICE_AREA_GAP_CSV_FEATURED_IMAGE,
} from "./bulk-ideas";
