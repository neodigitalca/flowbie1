import type { AspectRatio } from "@/lib/image-api";

/** OpenRouter id for default image generation (Nano Banana 2). */
export const DEFAULT_IMAGE_MODEL = "google/gemini-3.1-flash-image";

/** Previous default (Nano Banana Pro). */
export const LEGACY_PRO_IMAGE_MODEL = "google/gemini-3-pro-image-preview";

export const IMAGE_MODEL_PRESETS: { value: string; label: string }[] = [
  { value: DEFAULT_IMAGE_MODEL, label: "Gemini 3.1 Flash Image" },
  { value: LEGACY_PRO_IMAGE_MODEL, label: "Gemini 3 Pro Image Preview" },
  { value: "google/gemini-3.1-flash-image-preview", label: "Gemini 3.1 Flash Image Preview" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "black-forest-labs/flux.2-klein-4b", label: "Flux.2 Klein 4B" },
];

/** Google image-output billing tier (USD per generated image). */
type ImageOutputTier = "1K" | "2K" | "4K";

const FLASH_OUTPUT_USD: Record<ImageOutputTier, number> = {
  "1K": 0.067,
  "2K": 0.101,
  "4K": 0.151,
};

const PRO_OUTPUT_USD: Record<ImageOutputTier, number> = {
  "1K": 0.134,
  "2K": 0.134,
  "4K": 0.24,
};

const ASPECT_RATIO_OUTPUT_TIER: Record<AspectRatio, ImageOutputTier> = {
  "1:1": "1K",
  "4:3": "2K",
  "3:4": "2K",
  "16:9": "2K",
  "9:16": "2K",
  "21:9": "4K",
  "9:19": "4K",
};

function outputTierForModel(model: string): typeof FLASH_OUTPUT_USD | typeof PRO_OUTPUT_USD {
  const id = model.trim().toLowerCase();
  if (id.includes("gemini-3-pro-image") || id.includes("nano-banana-pro")) {
    return PRO_OUTPUT_USD;
  }
  return FLASH_OUTPUT_USD;
}

/** Estimated USD for one generated image (image-output tokens only; excludes prompt text). */
export function estimateImageOutputCostUsd(model: string, aspectRatio: AspectRatio): number {
  const tier = ASPECT_RATIO_OUTPUT_TIER[aspectRatio];
  return outputTierForModel(model)[tier];
}

export type ImageModelCostComparison = {
  aspectRatio: AspectRatio;
  tier: ImageOutputTier;
  legacyModel: string;
  legacyUsd: number;
  currentModel: string;
  currentUsd: number;
  savingsUsd: number;
  savingsPercent: number;
};

/** Cost delta: legacy Pro default vs current Flash default at a given aspect ratio. */
export function compareDefaultImageModelCost(aspectRatio: AspectRatio): ImageModelCostComparison {
  const tier = ASPECT_RATIO_OUTPUT_TIER[aspectRatio];
  const legacyUsd = estimateImageOutputCostUsd(LEGACY_PRO_IMAGE_MODEL, aspectRatio);
  const currentUsd = estimateImageOutputCostUsd(DEFAULT_IMAGE_MODEL, aspectRatio);
  const savingsUsd = legacyUsd - currentUsd;
  const savingsPercent = legacyUsd > 0 ? Math.round((savingsUsd / legacyUsd) * 100) : 0;
  return {
    aspectRatio,
    tier,
    legacyModel: LEGACY_PRO_IMAGE_MODEL,
    legacyUsd,
    currentModel: DEFAULT_IMAGE_MODEL,
    currentUsd,
    savingsUsd,
    savingsPercent,
  };
}
