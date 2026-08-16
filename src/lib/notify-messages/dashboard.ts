/** Notify copy: dashboard. */

export const NOTIFY_API_KEY_SAVED_AND_UPDATED_FOR_CURRENT_SE = "API Key saved and updated for current session.";
export const NOTIFY_API_KEY_CLEARED_AI_GENERATION_IS_DISABLE = "API Key cleared. AI generation is disabled.";
export const NOTIFY_DATAFORSEO_API_KEY_SAVED_SUCCESSFULLY = "DataForSEO API Key saved successfully.";
export const NOTIFY_DATAFORSEO_API_KEY_CLEARED = "DataForSEO API Key cleared.";
export const NOTIFY_CLIENT_ID_SHOULD_BE_THE_FULL_VALUE_FROM_ = "Use full Google Cloud Client ID";
export const NOTIFY_REDIRECT_URI_COPIED = "Redirect URI copied";
export const NOTIFY_GSC_EMAIL_COPIED_TO_CLIPBOARD = "GSC email copied to clipboard";
export const NOTIFY_FAILED_TO_COPY_EMAIL_TO_CLIPBOARD = "Failed to copy email to clipboard";
export const NOTIFY_PROPERTY_LIST_COPIED_TO_CLIPBOARD = "Property list copied to clipboard";
export const NOTIFY_FAILED_TO_COPY_LIST = "Failed to copy list";
export const NOTIFY_TESTING_GSC_CONNECTION = "Testing GSC connection";
export const NOTIFY_GSC_NO_PROPERTIES_RETURNED = "GSC: no properties returned";
export const NOTIFY_GSC_QUERIES_FETCHED_BUT_KEYWORD_ANALYSIS = "GSC fetched, keyword analysis failed";
export const NOTIFY_NO_ANALYSIS_RESULTS_GENERATED_PLEASE_CHE = "No analysis results";
export const NOTIFY_LIST_LOADED = "List loaded";
export const NOTIFY_SELECT_A_WORDPRESS_SITE_FIRST = "Select a WordPress site first.";
export const NOTIFY_COULD_NOT_SAVE_FILES_TO_LOCAL_STORAGE = "Could not save files to local storage";
export const NOTIFY_PLEASE_ENTER_A_PROFILE_NAME = "Please enter a profile name";
export const NOTIFY_PROFILE_SAVED = "Profile saved";
export const NOTIFY_PLEASE_SELECT_A_PROFILE_TO_UPDATE = "Please select a profile to update";
export const NOTIFY_PROFILE_UPDATED = "Profile updated";
export const NOTIFY_CONTENT_CLEARED = "Content cleared";
export const NOTIFY_FILE_DELETED = "File deleted";
export const NOTIFY_PLEASE_ENTER_A_URL_TO_SCRAPE = "Please enter a URL to scrape";
export const NOTIFY_A_SCRAPE_IS_ALREADY_RUNNING = "A scrape is already running";
export const NOTIFY_FAILED_TO_START_SITE_SCRAPER = "Failed to start site scraper";
export const NOTIFY_STREAMING_NOT_SUPPORTED_IN_THIS_BROWSER = "Streaming not supported in this browser";
export const NOTIFY_SCRAPER_FINISHED_BUT_NO_PAGES_WERE_STORE = "Scraper finished, no pages stored";
export const NOTIFY_SITE_SCRAPE_CANCELLED = "Site scrape cancelled";
export const NOTIFY_SITE_SCRAPER_FAILED_SEE_CONSOLE_FOR_DETA = "Site scraper failed. See console for details.";
export const NOTIFY_STARTED_A_NEW_CONVERSATION = "Started a new conversation.";
export const NOTIFY_SIGN_IN_TO_LOAD_SETTINGS_FROM_THE_CLOUD = "Sign in to load settings from the cloud";
export const NOTIFY_SIGN_IN_TO_SAVE_SUPABASE_CREDENTIALS = "Sign in to save Supabase credentials";
export const NOTIFY_ENTER_PROJECT_URL_AND_SERVICE_ROLE_KEY = "Enter project URL and service role key";
export const NOTIFY_SUPABASE_CREDENTIALS_SAVED_ON_THE_API_SE = "Supabase credentials saved on the API server";
export const NOTIFY_SIGN_IN_TO_CLEAR_SAVED_CREDENTIALS = "Sign in to clear saved credentials";
export const NOTIFY_REMOVED_SAVED_FILE_CREDENTIALS = "Removed saved file credentials";
export const NOTIFY_SIGN_IN_TO_APPLY_MIGRATION = "Sign in to apply migration";
export const NOTIFY_POST_BANK_AND_SAP_BANK_SQL_APPLIED_TRY_C = "Bank SQL applied, create table";
export const NOTIFY_SIGN_IN_TO_CREATE_THE_BANK_TABLE = "Sign in to create the bank table";
export const NOTIFY_PICK_A_PROPERTY_ID_FROM_INTEGRATIONS = "Pick a property id from Integrations";
export const NOTIFY_BLUEPRINT_RESET_SUCCESSFUL_READY_FOR_A_N = "Blueprint reset, ready for new";
export const NOTIFY_WORKSPACE_RESET_SUCCESSFUL_ALL_CACHE_CLE = "Workspace reset";
export const NOTIFY_DRAFT_IS_INVALID_OR_USES_A_RETIRED_FORMA = "Draft invalid or retired format";
export const NOTIFY_DRAFT_RECOVERED_SUCCESSFULLY = "Draft recovered successfully";

export function notifyGscConnectedXProperties(siteCount: string | number): string {
  return `GSC connected (${siteCount} properties)`;
}

export function notifyFetchingGscQueriesForX(_siteName: string | number): string {
  return "Fetching GSC queries";
}

export function notifyNoGscQueriesFoundForXInTheSpecif(_siteName: string | number): string {
  return "No GSC queries in date range";
}

export function notifyFetchedXGscQueriesAnalyzingXUnique(dataQueriesLength: string | number, uniquequeriesLength: string | number): string {
  return `Fetched ${dataQueriesLength} GSC queries. Analyzing ${uniquequeriesLength} unique keywords`;
}

export function notifyKeywordAnalysisCompleteFoundMetrics(keywordCount: string | number): string {
  return `Keyword analysis complete. Found metrics for ${keywordCount} keywords.`;
}

export function notifyRunningXAnalysisMethodS(selectedmethodsLength: string | number): string {
  return `Running ${selectedmethodsLength} analysis method(s)`;
}

export function notifySuccessfullyAnalyzedGscQueriesFromX(
  _siteName: string | number,
  _metricsMessage: string | number,
  _analysisMessage: string | number,
): string {
  return "GSC queries analyzed";
}

export function notifyGscQueriesAddedX(dataQueriesLength: string | number): string {
  return `GSC queries added (${dataQueriesLength})`;
}

export function notifyXFileSUploadedPotentiallyMultipleC(allnewfilesLength: string | number): string {
  return `${allnewfilesLength} file(s) uploaded (potentially multiple chunks per file)`;
}

export function notifyXKnowledgeBaseFilesBrutallyWipedFr(filecount0Filecount0: string | number): string {
  return `${filecount0Filecount0} Knowledge Base files brutally wiped from cache.`;
}

export function notifyXUnstarredFileSCleared(fileCount: string | number): string {
  return `${fileCount} unstarred file(s) cleared.`;
}

export function notifyScrapedXPageSIntoKnowledgeBase(newfilesLength: string | number): string {
  return `Scraped ${newfilesLength} page(s) into Knowledge Base`;
}

export function notifyRestoredXKeysFromCloudReloading(appliedKeycount: string | number): string {
  return `Restored ${appliedKeycount} keys from cloud. Reloading`;
}

/** Inventory pass 2 */

