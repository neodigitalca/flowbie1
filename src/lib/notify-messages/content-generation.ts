/** Notify copy: content-generation. */

export const NOTIFY_CONTENT_OPTIMIZATION_DISABLED_PROCEEDING = "Optimization off, uploading";
export const NOTIFY_FAILED_TO_GENERATE_EXTRA_TEXT_CONTINUING = "Extra text failed, continuing";
export const NOTIFY_FAILED_TO_GENERATE_EXTRA_IMAGE_CONTINUIN = "Extra image failed, continuing";
export const NOTIFY_FAILED_TO_ENSURE_LINKS_IN_EXTRA_CONTENT_ = "Extra content links failed, continuing";
export const NOTIFY_POST_UPLOAD_COMPLETED_BUT_MAY_NOT_HAVE_B = "Upload done, success unclear";
export const NOTIFY_IMPLEMENTATION_REPORT_GENERATED = "Implementation report generated";
export const NOTIFY_CONTENT_OPTIMIZED_BUT_IMPLEMENTATION_REP = "Optimized, report generation failed";
export const NOTIFY_CONTENT_SAVED_BUT_ORIGIN_FIELD_UPDATE_EN = "Saved, Origin field update failed";
export const NOTIFY_CONTENT_SAVED_BUT_ACF_SEO_STEP_SKIPPED_C = "Saved, ACF SEO step skipped";
export const NOTIFY_GENERATING_SEO_FIELDS_FOR_ACF = "Generating SEO fields for ACF";
export const NOTIFY_SEO_AI_RAN_BUT_NO_MATCHING_ACF_FIELDS_WE = "SEO AI ran, no ACF fields matched";
export const NOTIFY_ACF_SEO_FIELDS_UPDATED = "ACF SEO fields updated";
export const NOTIFY_CONTENT_SAVED_BUT_ACF_SEO_FIELD_UPDATE_F = "Content saved, but ACF SEO field update failed.";
export const NOTIFY_CONTENT_SAVED_BUT_ACF_SEO_OPTIMIZATION_E = "Saved, ACF SEO optimization failed";
export const NOTIFY_GENERATING_CONTENT = "Generating content";
export const NOTIFY_CONTENT_GENERATED = "Content generated";
export const NOTIFY_GENERATING_IN_CONTENT_IMAGE = "Generating in-content image";
export const NOTIFY_IMAGE_GENERATED_BUT_MAY_NOT_HAVE_BEEN_IN = "Image generated, insert may have failed";
export const NOTIFY_IN_CONTENT_IMAGE_WAS_NOT_PRESERVED_DURIN = "In-content image lost in conversion";
export const NOTIFY_HTML_READY_TO_UPLOAD = "HTML ready to upload";
export const NOTIFY_GOOGLE_MAPS_FEATURED_IMAGE_GENERATED_BUT = "Map image upload failed, continuing";
export const NOTIFY_FEATURED_IMAGE_GENERATED_BUT_UPLOAD_FAIL = "Featured image upload failed";
export const NOTIFY_FEATURED_IMAGE_GENERATION_FAILED_CONTINU = "Featured image failed, continuing";

export function notifyXPostInWordpress(contextUpdatemodeUpdateUpdatingCreating: string | number): string {
  return `${contextUpdatemodeUpdateUpdatingCreating} post in WordPress`;
}

export function notifyOptimizedXs(uploadTime: string | number): string {
  return `Optimized (${uploadTime}s)`;
}

export function notifyViewPostX(link: string | number): string {
  return `View post: ${link}`;
}

export function notifyOriginFieldUpdatedX(originresultOrigin: string | number): string {
  return `Origin field updated: ${originresultOrigin}`;
}

export function notifyContentSavedButOriginFieldUpdateFa(originresultError: string | number): string {
  return `Content saved, but Origin field update failed: ${originresultError}`;
}

export function notifyInContentImageGeneratedAndInserted(imageresultSectionheader: string | number): string {
  return `In-content image generated and inserted into "${imageresultSectionheader}" section`;
}

export function notifyInContentImageGenerationFailedXCon(_errorMessage: string | number): string {
  return "In-content image generation failed";
}

export function notifyFoundXValidImagesWithUrlsAndAltT(originalimagesLength: string | number): string {
  return `Found ${originalimagesLength} media link(s) (from original image/video metadata) to place in optimized content`;
}

export function notifyPreservedXOriginalImagesInOptimized(imageassignmentsLength: string | number): string {
  return `Placed ${imageassignmentsLength} original media link(s) in optimized content`;
}

export function notifyImagePreservationFailedXContinuingW(_errorMessage: string | number): string {
  return "Media link preservation failed";
}

export function notifyKeepingExistingFeaturedImageIdX(featuredImageId: string | number): string {
  return `Keeping existing featured image (ID: ${featuredImageId})`;
}

export function notifyGoogleMapsFeaturedImageGeneratedAnd(featuredImageId: string | number): string {
  return `Google Maps featured image generated and uploaded (ID: ${featuredImageId})`;
}

export function notifyGoogleMapsFeaturedImageGenerationFa(_errorInstanceofErrorErrorMessageUnknownE: string | number): string {
  return "Map featured image generation failed";
}

export function notifyFeaturedImageGeneratedAndUploadedId(featuredImageId: string | number): string {
  return `Featured image generated and uploaded (ID: ${featuredImageId})`;
}
