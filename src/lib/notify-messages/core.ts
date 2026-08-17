/** Notify copy: core. */

export { notifyActionFailed, notifyErrorMessage } from "./core-helpers";

export const NOTIFY_SOME_FILES_WERE_REJECTED_ONLY_TEXT_PDF_J = "Some files rejected, see allowed types";
export const NOTIFY_OPENROUTER_API_KEY_REQUIRED = "OpenRouter API key required.";
export const NOTIFY_SET_GOOGLE_BUSINESS_PROFILE_LOCATION_ID_ = "Set GBP Location ID in settings";
export const NOTIFY_NO_URLS_FOUND_IN_SITEMAP = "No URLs found in sitemap";
export const NOTIFY_OPENROUTER_API_KEY_IS_REQUIRED_PLEASE_SE = "OpenRouter key required in Settings";
export const NOTIFY_COULD_NOT_DETERMINE_GEOGRAPHIC_AREA_FROM = "Area unknown from URLs, add cities";
export const NOTIFY_DATAFORSEO_SEARCH_FAILED_FALLING_BACK_TO = "DataForSEO failed, using Wikipedia";
export const NOTIFY_GETTING_PAGES_FROM_WIKIPEDIA_CATEGORIES = "Getting pages from Wikipedia categories";
export const NOTIFY_USING_AI_TO_SELECT_BEST_WIKIPEDIA_LIST_P = "Using AI to select best Wikipedia list page";
export const NOTIFY_COULD_NOT_SELECT_A_WIKIPEDIA_LIST_PAGE_P = "Wikipedia list page not found";
export const NOTIFY_CHECKING_SCHEDULED_POSTS_FOR_CONFLICTS = "Checking scheduled posts for conflicts";
export const NOTIFY_SEARCHING_FOR_MORE_ENTITIES_WITH_ALTERNA = "Searching entities, alt query";
export const NOTIFY_XML_PARSING_ERROR_FOR_BLINDSWEST_CA_SITE = "XML parsing error for blindswest.ca sitemap.nn";
export const NOTIFY_SERVER_ERROR_WHILE_PARSING_SITEMAP_FOR_B = "Sitemap parse server error";
export const NOTIFY_NO_ENTITIES_AVAILABLE_FOR_TITLE_SUGGESTI = "No entities available for title suggestion";
export const NOTIFY_TITLE_TEMPLATE_SUGGESTED = "Title template suggested";
export const NOTIFY_FAILED_TO_GENERATE_TITLE_SUGGESTION = "Failed to generate title suggestion";
export const NOTIFY_NO_ENTITIES_TO_GENERATE_CSV_FROM = "No entities to generate CSV from";
export const NOTIFY_ORIGINS_COPIED_TO_CLIPBOARD = "Origins copied to clipboard";
export const NOTIFY_FAILED_TO_COPY_TO_CLIPBOARD = "Failed to copy to clipboard";
export const NOTIFY_ORIGIN_COPIED = "Origin copied";
export const NOTIFY_FAILED_TO_COPY = "Failed to copy";
export const NOTIFY_COULD_NOT_SAVE_SITES_TO_LOCAL_STORAGE = "Could not save sites to local storage";
export const NOTIFY_QUARTER_COUNTS_ARE_NOT_READY_USE_REFRESH = "Quarter counts not ready, refresh";
export const NOTIFY_SIGN_IN_TO_SAVE_SETTINGS_TO_THE_CLOUD = "Sign in to save settings to workspace storage";
export const NOTIFY_NO_SITES_TO_EXPORT = "No sites to export.";
export const NOTIFY_PLEASE_SELECT_A_TITLE_OPTION_OR_ENTER_A_ = "Pick a title or enter custom";
export const NOTIFY_BLUEPRINT_DELETED_SUCCESSFULLY = "Blueprint deleted successfully";
export const NOTIFY_INVALID_BLUEPRINT_FLOW_V2_JSON_REQUIRED_ = "Invalid blueprint, need Flow v2 JSON";
export const NOTIFY_FAILED_TO_PARSE_JSON_FILE = "Failed to parse JSON file.";
export const NOTIFY_BLUEPRINT_DOWNLOADED = "Blueprint downloaded";
export const NOTIFY_THIS_BLUEPRINT_USES_A_RETIRED_FORMAT_CRE = "Retired blueprint format";
export const NOTIFY_BLUEPRINT_LOADED_KB_FILES_MATCHED_FOR_RA = "Blueprint loaded. KB files matched for RAG.";
export const NOTIFY_PLEASE_SELECT_A_VALID_JSON_FILE = "Please select a valid JSON file.";
export const NOTIFY_SELECTED_WIKIPEDIA_CATEGORIES_HAD_NO_PAG = "Wikipedia categories had no pages";

export function notifyPublishedToGbpForX(_rowTitle: string | number): string {
  return "Published to GBP";
}

export function notifyParsingSitemapX(entitySitemapUrl: string | number): string {
  return `Parsing sitemap: ${entitySitemapUrl}`;
}

export function notifyFoundXUrlsAnalyzingWithAi(parseresultUrlsLength: string | number): string {
  return `Found ${parseresultUrlsLength} URLs. Analyzing with AI`;
}

export function notifyUsingDataforseoToSearchGoogleForEn(promptModifier: string | number): string {
  return `Using DataForSEO to search Google for entities matching "${promptModifier}"`;
}

export function notifySearchingGoogleForX(researchQuestion: string | number): string {
  return `Searching Google for: "${researchQuestion}"`;
}

export function notifyUsingAiToFindSimilarWikipediaList(promptModifier: string | number): string {
  return `Using AI to find similar Wikipedia list pages for "${promptModifier}"`;
}

export function notifyFindingWikipediaCategoryPagesForXP(primaryCity: string, promptModifier?: string): string {
  return promptModifier
    ? `Finding Wikipedia category pages for ${primaryCity} (${promptModifier})`
    : `Finding Wikipedia category pages for ${primaryCity}`;
}

export function notifyValidatingEntitiesWithWikipediaPromp(
  found: number,
  total: number,
  promptModifier?: string
): string {
  if (promptModifier) {
    return `Validating entities with Wikipedia, criteria: "${promptModifier}" (${found}/${total} matched)`;
  }
  return `Validating entities with Wikipedia (${found}/${total} matched)`;
}

export function notifyNoWikipediaPagesFoundForXTryAddin(primaryCity: string | number): string {
  return `No Wikipedia pages found for ${primaryCity}. Try adding a modifier or ensure service-area URLs contain city names.`;
}

export function notifyWikipediaPageXNotFoundPleaseTryA(selectedPageTitle: string | number): string {
  return `Wikipedia page "${selectedPageTitle}" not found. Please try a different modifier.`;
}

export function notifyUsingAiToExtractEntitiesFromWikipe(selectedPageTitle: string | number): string {
  return `Using AI to extract entities from Wikipedia: ${selectedPageTitle}`;
}

export function notifyAllEntitiesWereFilteredOutXConflic(conflictWithExistingCount: string | number, conflictWithPostsCount: string | number, sitemapFilteredCount: string | number): string {
  return `All entities were filtered out. ${conflictWithExistingCount} conflicted with existing, ${conflictWithPostsCount} conflicted with scheduled posts, ${sitemapFilteredCount} exist in sitemap.`;
}

export function notifyAllXValidatedEntitiesWereFilteredO(validatedentitiesLength: string | number, conflictWithExistingCount: string | number, conflictWithPostsCount: string | number): string {
  return `All ${validatedentitiesLength} validated entities were filtered out. ${conflictWithExistingCount} conflicted with existing entities, ${conflictWithPostsCount} conflicted with scheduled posts.`;
}

export function notifyValidatingXAgainstCriteria(validatedEntity: string | number): string {
  return `Validating "${validatedEntity}" against criteria`;
}

export function notifyFoundXXEntitiesMatchingCriteriaTri(finalentitiesLength: string | number, count: string | number, processedentitynamesSize: string | number): string {
  return `Found ${finalentitiesLength}/${count} entities matching criteria. Tried ${processedentitynamesSize} candidates but couldn't find ${count} matching entities.`;
}

export function notifyGeneratedXEntities(finalentitiesLength: string | number): string {
  return `Generated ${finalentitiesLength} entities`;
}

export function notifyEntityGenerationFailedForBlindswest(_errorMessage: string | number): string {
  return "Entity generation failed";
}

export function notifyEntityGenerationFailedForBlindswest2(_error: string | number): string {
  return "Entity generation failed";
}

export function notifyFailedToGenerateTitleSuggestionX(_errorInstanceofErrorErrorMessageUnknownE: string | number): string {
  return "Title suggestion failed";
}

export function notifyCsvTemplateWithXEntitiesDownloaded(entitiesLength: string | number): string {
  return `CSV template with ${entitiesLength} entities downloaded`;
}

export function notifyCopiedXToClipboard(value: string | number): string {
  return `Copied ${value} to clipboard`;
}

export function notifyExportedXSiteSToCsv(sitesLength: string | number): string {
  return `Exported ${sitesLength} site(s) to CSV.`;
}

export function notifyBlueprintXSavedSuccessfully(blueprintTitle: string | number): string {
  return `Blueprint "${blueprintTitle}" saved successfully`;
}

export function notifyXAttachedFileSMissingUploadViaKb(missingFiles: string | number): string {
  return `${missingFiles} attached file(s) missing. Upload via KB Manager for full RAG.`;
}

/** Inventory pass 2 */
export function notifyXX(fileName: string | number, errInstanceofErrorErrMessageCouldNotRead: string | number): string {
  return `${fileName}: ${errInstanceofErrorErrMessageCouldNotRead}`;
}

export function notifyXPropertxXPublishedXQueued(
  _propertiesAttempted: string | number,
  _propertiesattempted1YIes: string | number,
  _published: string | number,
  _queued: string | number,
): string {
  return "GBP batch complete";
}

