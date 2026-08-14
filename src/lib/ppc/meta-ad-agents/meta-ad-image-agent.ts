import { generateImage } from "@/lib/image-api";
import { DEFAULT_IMAGE_MODEL } from "@/lib/image-model-defaults";
import {
  buildMetaImagePrompt,
  buildMetaImagePromptDescription,
} from "@/lib/ppc/meta-ad-prompt-builder";
import type { MetaInstagramReferenceResult } from "@/lib/ppc/meta-ad-agents/meta-ad-instagram-reference-agent";
import type {
  MetaAdBlueprint,
  MetaAdChecklistItem,
  MetaAdColorPalette,
  MetaAdCreative,
  MetaAdCreativeBrief,
  MetaAdInstagramGoal,
  MetaAdPlacement,
} from "@/lib/ppc/meta-ads-types";
import type { MetaAdTypographyStyle } from "@/lib/ppc/meta-ad-typography-styles";
import { metaPlacementToImageAspectRatio } from "@/lib/ppc/meta-ads-types";

export type RunMetaAdImageResult = {
  creative: MetaAdCreative;
  imagePromptDescription: string;
  imagePrompt: string;
};

/** Image generate agent */
export async function runMetaAdImageAgent(options: {
  apiKey: string;
  model?: string;
  researchModel?: string;
  siteId?: string;
  goal: MetaAdInstagramGoal;
  blueprint: MetaAdBlueprint;
  creativeBrief: MetaAdCreativeBrief;
  focusKeyword?: string;
  checklist: MetaAdChecklistItem[];
  placement: MetaAdPlacement;
  reference?: MetaInstagramReferenceResult;
  allowPeopleInImage?: boolean;
  imagePromptModifier?: string;
  colorPalette?: MetaAdColorPalette;
  signal?: AbortSignal;
  localityCity?: string;
  siteName?: string;
  typographyStyle?: MetaAdTypographyStyle;
}): Promise<RunMetaAdImageResult> {
  if (!options.apiKey?.trim()) {
    throw new Error("OpenRouter API key is missing. Set it in Settings first.");
  }
  if (options.signal?.aborted) {
    throw new Error("Generation cancelled");
  }
  if (!options.creativeBrief) {
    throw new Error("Creative brief is required for image generation.");
  }

  const reference = options.reference;
  if (!reference?.referenceElements?.length) {
    throw new Error("Image reference result with visual plan elements is required.");
  }

  const promptDescription = buildMetaImagePromptDescription({
    creativeBrief: options.creativeBrief,
    focusKeyword: options.focusKeyword,
    placement: options.placement,
    allowPeopleInImage: options.allowPeopleInImage,
    imagePromptModifier: options.imagePromptModifier,
    visualReferenceElements: reference.referenceElements,
    localityCity: options.localityCity,
    typographyStyle: options.typographyStyle,
    colorPalette: options.colorPalette,
  });

  const prompt = buildMetaImagePrompt({
    creativeBrief: options.creativeBrief,
    goal: options.goal,
    focusKeyword: options.focusKeyword,
    checklist: options.checklist,
    placement: options.placement,
    referencePromptSuffix: reference.promptSuffix,
    allowPeopleInImage: options.allowPeopleInImage,
    imagePromptModifier: options.imagePromptModifier,
    visualReferenceElements: reference.referenceElements,
    localityCity: options.localityCity,
    siteName: options.siteName,
    typographyStyle: options.typographyStyle,
    colorPalette: options.colorPalette,
  });

  const aspectRatio = metaPlacementToImageAspectRatio(options.placement);
  const response = await generateImage({
    apiKey: options.apiKey,
    prompt,
    model: options.model ?? DEFAULT_IMAGE_MODEL,
    aspectRatio,
    referenceImageDataUrls: reference.referenceDataUrls,
  });

  if (response.error) {
    throw new Error(response.error);
  }

  const previewUrl = response.imageBase64 ?? response.imageUrl ?? null;
  if (!previewUrl) {
    throw new Error("Image generation returned no image.");
  }

  return {
    imagePromptDescription: promptDescription,
    imagePrompt: prompt,
    creative: {
      imagePreviewUrl: previewUrl.startsWith("data:") ? previewUrl : response.imageUrl ?? previewUrl,
      imageBase64: response.imageBase64 ?? null,
      aspectRatio: options.placement,
    },
  };
}
