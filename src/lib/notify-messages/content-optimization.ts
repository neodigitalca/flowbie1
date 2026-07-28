/** Notify copy: content-optimization. */

export const NOTIFY_BATCH_CLEARED_FROM_VIEW = "Batch cleared from view";
export const NOTIFY_STILL_INITIALIZING_THIS_ROW_TRY_AGAIN = "Row still loading";
export const NOTIFY_SAVE_AN_ENTITY_URL_FOR_THIS_SITE_IN_INTE = "Save entity URL in Integrations";
export const NOTIFY_DETECT_POSTS_FOR_THIS_PROPERTY_IN_INTEGR = "Detect posts in Integrations first";
export const NOTIFY_BOTH_NEEDS_POST_AND_ENTITY_IN_INTEGRATIO = "Both needs post and entity in Integrations.";
export const NOTIFY_NO_POST_OR_ENTITY_URLS_FOR_THIS_SITE = "No post or entity URLs for this site.";
export const NOTIFY_POST_BATCH_DID_NOT_FINISH_SAP_ENTITY_BAT = "Post batch incomplete, SAP not started";
export const NOTIFY_ENTITY_BATCH_DID_NOT_FINISH = "Entity batch did not finish.";
export const NOTIFY_NO_POST_URLS_FOR_THIS_SITE = "No post URLs for this site.";
export const NOTIFY_POST_BATCH_DID_NOT_FINISH_ENTITY_WAS_NOT = "Post batch incomplete, entity not started";
export const NOTIFY_NO_ENTITY_URLS_FOR_THIS_SITE = "No entity URLs for this site.";
export const NOTIFY_NO_URLS_FOR_THIS_SOURCE_ON_THIS_SITE = "No URLs for this source on this site.";
export const NOTIFY_NO_SELECTED_SITES_ARE_READY_TO_OPTIMIZE = "No selected sites are ready to optimize.";
export const NOTIFY_USING_TEST_BLUEPRINT_DATA = "Using test blueprint data";
export const NOTIFY_PLEASE_SELECT_AT_LEAST_ONE_POST_TO_OPTIM = "Please select at least one post to optimize";
export const NOTIFY_WORDPRESS_SITE_URL_USERNAME_AND_APPLICAT = "WordPress URL, user, password required";
export const NOTIFY_OPENROUTER_API_KEY_REQUIRED_FOR_SEO_EXTR = "OpenRouter key needed for SEO text";
export const NOTIFY_NO_TARGETS_COULD_RUN_CHECK_ROW_POST_IDS_ = "No targets ran, check post IDs";
export const NOTIFY_WORDPRESS_LINKS_UNAVAILABLE_CONTINUING_W = "WP links unavailable, continuing";
export const NOTIFY_FETCHING_POST_BY_URL = "Fetching post by URL";
export const NOTIFY_FETCHING_EXISTING_POST_CONTENT = "Fetching existing post content";
export const NOTIFY_PLEASE_ENTER_A_URL_TO_OPTIMIZE = "Please enter a URL to optimize";
export const NOTIFY_FAILED_TO_INITIALIZE_OPTIMIZATION_PLEASE = "Optimization init failed";
export const NOTIFY_SKIPPED_PROMPT_MODIFIER = "Skipped (prompt modifier)";
export const NOTIFY_IMAGE_GENERATION_ENABLED_PER_PROMPT_MODI = "Image generation enabled per prompt modifier";
export const NOTIFY_IMAGE_GENERATION_DISABLED_PER_PROMPT_MOD = "Image generation disabled per prompt modifier";
export const NOTIFY_ACF_KEYWORD_MODE_NEEDS_KEYWORD_FOCUS = "ACF keyword mode needs keyword_focus";
export const NOTIFY_APPLYING_SEM_CHECKLIST = "Applying SEM checklist";
export const NOTIFY_OPTIMIZATION_FUNCTION_NOT_READY_PLEASE_T = "Optimization not ready";
export const NOTIFY_EDITING_ACF_FIELDS_ONLY = "Editing ACF fields only";
export const NOTIFY_ACF_UPDATED = "ACF updated";
export const NOTIFY_USING_TEST_KEYWORD_DATA = "Using test keyword data";
export const NOTIFY_CONNECT_A_WORDPRESS_SITE_FIRST_IN_THE_IN = "Connect WordPress in Integrations";
export const NOTIFY_NO_ROWS_MATCHED_WORDPRESS_INVENTORY = "No rows matched WordPress inventory.";
export const NOTIFY_CSV_DOWNLOADED = "CSV downloaded.";
export const NOTIFY_A_BULK_RUN_IS_ALREADY_IN_PROGRESS = "A bulk run is already in progress.";
export const NOTIFY_NO_POST_ID_ON_GRID_ROWS_SCRAPE_OR_LOAD_T = "No post ID, load sitemap first";
export const NOTIFY_NOTHING_TO_UPLOAD_ROWS_HAVE_NO_TITLE_MET = "Nothing to upload on these rows";
export const NOTIFY_GENERATING_OPTIMIZED_BLUEPRINT_THIS_STEP = "Generating blueprint (30-60s)";
export const NOTIFY_ANALYZING_KEYWORD_WITH_AI_ANALYZING_SERP = "Analyzing keyword and SERP";
export const NOTIFY_GETTING_KEYWORD_RECOMMENDATION = "Getting keyword recommendation";
export const NOTIFY_KEYWORD_RECOMMENDATION_READY = "Keyword recommendation ready";
export const NOTIFY_USING_GSC_ONLY = "Using Search Console only";
export const NOTIFY_NO_SEO_RESEARCH_FIELD = "No SEO research field";
export const NOTIFY_OPTIMIZING_WITHOUT_GSC = "Optimizing without Search Console";
export const NOTIFY_STAGING_NO_GSC = "Staging site: no Search Console";
export const NOTIFY_APPROVAL_EXPIRED = "Approval expired. Restart the run";

export function notifyNoOptimizationsRemainingThisPeriodF(_siteName: string | number): string {
  return "No optimizations left this period";
}

export function notifyBothPostUrlsXOnX(postpickLength: string | number, _siteName: string | number): string {
  return `Both: ${postpickLength} post URL(s)`;
}

export function notifyBothSapEntityUrlsXOnX(entpickLength: string | number, _siteName: string | number): string {
  return `Both: ${entpickLength} SAP/entity URL(s)`;
}

export function notifyBothPostFirstXUrlSOnX(postresUrlsLength: string | number, _siteName: string | number): string {
  return `Both: ${postresUrlsLength} post URL(s) first`;
}

export function notifyBothEntityXUrlSOnX(entresUrlsLength: string | number, _siteName: string | number): string {
  return `Both: ${entresUrlsLength} entity URL(s)`;
}

export function notifyOptimizingXUrlSOnX(pickedLength: string | number, _siteName: string | number): string {
  return `Optimizing ${pickedLength} URL(s)`;
}

export function notifySkippedXSiteSNotConfiguredForCurr(skipped: string | number): string {
  return `Skipped ${skipped} site(s) (not configured for current mode).`;
}

export function notifySeoResearchNoSerpFileReturnedForX(k: string | number): string {
  return `SEO research: no SERP file returned for "${k}".`;
}

export function notifySeoResearchCouldNotLoadSerpJsonFo(k: string | number): string {
  return `SEO research: could not load SERP JSON for "${k}".`;
}

export function notifySeoResearchErrorForX(k: string | number): string {
  return `SEO research error for "${k}".`;
}

export function notifyFilledSeoResearchFromSerpForXUrl(filled: string | number): string {
  return `Filled seo_research from SERP for ${filled} URL(s).`;
}

export function notifyCompletedOptimizationForPostXOfX(_currentPost: string | number, _totalPosts: string | number): string {
  return "Post optimized";
}

export function notifyFailedToOptimizePostXX(currentPost: string | number, _errorMessage: string | number): string {
  return `Post ${currentPost} failed`;
}

export function notifyBatchOptimizationCompleteProcessedX(_urlsLength: string | number): string {
  return "Batch done";
}

export function notifyProcessingXTargetsInXPagesOfX(_urlsLength: string | number, _bulkpagerangesLength: string | number, _CONTENT_OPTIMIZER_BULK_PAGE_SIZE: string | number): string {
  return "Processing batch";
}

export function notifyPreparingXTargetsAcfFirst(_urlsLength: string | number): string {
  return "Preparing batch";
}

export function notifySkippedXNoSeoResearchAfterSerp(_url: string | number): string {
  return "Skipped, no SERP data";
}

export function notifyBulkSeoExtraTextFailedX(_errorMessage: string | number): string {
  return "Bulk SEO extra text failed";
}

export function notifyBatchOptimizationFailedX(_errorMessage: string | number): string {
  return "Batch optimization failed";
}

export function notifyBulkSeoExtraTextFailedForAllXTar(batchstatsUploadfail: string | number): string {
  return `Bulk SEO extra text failed for all ${batchstatsUploadfail} target(s).`;
}

export function notifyBulkSeoExtraTextXUploadedBatchstat(uploadOk: number, uploadFail: number): string {
  if (uploadFail > 0) {
    return `Bulk SEO extra text: ${uploadOk} uploaded, ${uploadFail} failed`;
  }
  return `Bulk SEO extra text: ${uploadOk} uploaded`;
}

export function notifyGeneratedLocalKeywordForEntityPage(aiGeneratedKeyword: string | number): string {
  return `Generated local keyword for entity page: "${aiGeneratedKeyword}"`;
}

export function notifyAiSelectedXRelevantItemsForKeyword(wordpresspostsLength: string | number): string {
  return `AI selected ${wordpresspostsLength} relevant items for keywords`;
}

export function notifyFetchingFullContentFromXSelectedIt(wordpresspostsLength: string | number): string {
  return `Fetching full content from ${wordpresspostsLength} selected items`;
}

export function notifyLoadedContentFromXWordpressItemsFo(ragcontentLength: string | number): string {
  return `Loaded content from ${ragcontentLength} WordPress items for AI context`;
}

export function notifyUrlIntentX(urlDerivedIntent: string | number): string {
  return `URL intent: "${urlDerivedIntent}"`;
}

export function notifyUsingManualKeywordOverrideX(manualKeyword: string | number): string {
  return `Using manual keyword override: "${manualKeyword}"`;
}

export function notifyUsingAcfKeywordFocusX(acfKeyword: string | number): string {
  return `Using ACF keyword_focus: "${acfKeyword}"`;
}

export function notifyTestModeFailedToUpdateAcfFieldsX(_errorMessage: string | number): string {
  return "ACF field update failed";
}

export function notifyTestModeErrorUpdatingAcfFieldsX(_acferrorInstanceofErrorAcferrorMessageUn: string | number): string {
  return "ACF field update error";
}

export function notifySkippingExternalKeywordApiUsingPrim(primaryKeyword: string | number): string {
  return `Skipping external keyword API. Using primary keyword only: ${primaryKeyword}`;
}

export function notifyResearchingKeywordXFetchingSearchVo(primaryKeyword: string | number): string {
  return `Researching keyword: ${primaryKeyword}... Fetching search volume and competition data.`;
}

export function notifyAiAnalysisCompleteSelectedXKeywords(selectedkeywordsLength: string | number, selectedh2sectionsLength: string | number): string {
  return `AI analysis complete. Selected ${selectedkeywordsLength} keywords, ${selectedh2sectionsLength} H2 sections.`;
}

export function notifyChecklistCreatedXItemsBuildingBluep(checklistLength: string | number): string {
  return `Checklist created (${checklistLength} items). Building blueprint structure`;
}

export function notifyBlueprintCreatedXSectionsStartingCo(blueprintresultAgentsLength: string | number): string {
  return `Blueprint created (${blueprintresultAgentsLength} sections). Starting content generation`;
}

export function notifyUsingGscDataForXXImpressionsXCli(
  keyword: string,
  impressions: number,
  clicks: number,
  relatedCount?: number
): string {
  const base = `Using Search Console data for "${keyword}" (${impressions} impressions, ${clicks} clicks)`;
  if (relatedCount && relatedCount > 0) {
    return `${base}, ${relatedCount} related keywords included`;
  }
  return base;
}

export function notifyKeywordResearchCompleteSearchVolume(searchVolume: number, relatedCount?: number): string {
  let msg = `Keyword research complete. Search volume: ${searchVolume}.`;
  if (relatedCount && relatedCount > 0) {
    msg += ` Included ${relatedCount} related Search Console keywords.`;
  }
  return msg;
}

export function notifyFoundXPeopleAlsoAskQuestions(countNumber: string | number): string {
  return `Found ${count} People Also Ask questions.`;
}

export function notifyAiAnalysisCompleteRelatedgsckeywords(relatedCount?: number): string {
  if (relatedCount && relatedCount > 0) {
    return `AI analysis complete. Included ${relatedCount} related Search Console keywords.`;
  }
  return "AI analysis complete.";
}
