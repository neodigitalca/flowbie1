import { generateImage } from "@/lib/image-api";
import { buildImagePrompt } from "@/lib/image-prompt-builder";
import type { ImageChecklistItem } from "@/lib/image-checklist-builder";
import type {
  ImageGenerationResult,
  ImageGeneratorOptions,
  ImageGeneratorRunContext,
} from "@/lib/image-generator/image-generator-options";
import {
  buildSoloImagePrompt,
  formatChecklistText,
  resolveEffectiveSourceMode,
  resolveSelectedSectionObj,
} from "@/lib/image-generator/image-generator-options";
import {
  buildGroundedImagePromptSuffix,
  collectReferenceDataUrls,
  researchGoogleImageReferences,
} from "@/lib/image-reference-research";
import { getResearchModel } from "@/lib/optimization-settings-storage";

function normalizeImageUrl(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, string | undefined>;
    const extracted = obj.url || obj.image_url || obj.href;
    if (!extracted) throw new Error("Image URL is an object but no URL property found");
    return extracted;
  }
  return String(raw);
}

function applyImageUrl(imageUrl: string): ImageGenerationResult {
  if (imageUrl.startsWith("data:")) {
    return {
      imageUrl: null,
      imageBase64: imageUrl,
      previewUrl: imageUrl,
      error: null,
    };
  }

  return {
    imageUrl,
    imageBase64: null,
    previewUrl: imageUrl,
    error: null,
  };
}

async function resolvePreviewUrl(imageUrl: string): Promise<string> {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return imageUrl;
  }
}

async function packageGenerationResult(
  result: { imageUrl?: string; imageBase64?: string; error?: string },
  referenceResearch: ImageGenerationResult["referenceResearch"],
): Promise<ImageGenerationResult> {
  if (result.error) {
    return {
      imageUrl: null,
      imageBase64: null,
      previewUrl: null,
      error: result.error,
      referenceResearch,
    };
  }

  if (result.imageUrl) {
    const imageUrl = normalizeImageUrl(result.imageUrl);
    if (!imageUrl || typeof imageUrl !== "string") {
      return {
        imageUrl: null,
        imageBase64: null,
        previewUrl: null,
        error: "Invalid image URL format received",
        referenceResearch,
      };
    }
    const applied = applyImageUrl(imageUrl);
    if (applied.previewUrl && !applied.previewUrl.startsWith("data:")) {
      applied.previewUrl = await resolvePreviewUrl(imageUrl);
    }
    return { ...applied, referenceResearch };
  }

  if (result.imageBase64) {
    const imageBase64 = String(result.imageBase64);
    const previewUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`;
    return { imageUrl: null, imageBase64, previewUrl, error: null, referenceResearch };
  }

  return {
    imageUrl: null,
    imageBase64: null,
    previewUrl: null,
    error: "No image data received",
    referenceResearch,
  };
}

export async function runFeaturedImage(
  options: ImageGeneratorOptions,
  context: ImageGeneratorRunContext,
  checklist: ImageChecklistItem[],
): Promise<ImageGenerationResult> {
  const effectiveMode = resolveEffectiveSourceMode(
    options.imageSourceMode,
    options.selectedSection,
  );

  if (effectiveMode === "solo") {
    const keyword = options.userPrompt.trim();
    if (!keyword) {
      return {
        imageUrl: null,
        imageBase64: null,
        previewUrl: null,
        error: "Enter a keyword for Solo mode",
        referenceResearch: { mode: "abstract", queries: [], references: [] },
      };
    }

    const research = await researchGoogleImageReferences({
      apiKey: context.apiKey,
      model: getResearchModel(),
      context: {
        title: keyword,
        userPrompt: keyword,
        body: keyword,
      },
      enablePlaceQueryFanOut: true,
    });

    const hasRefs = research.references.length > 0;
    const prompt =
      buildSoloImagePrompt(keyword, options, hasRefs) +
      buildGroundedImagePromptSuffix(research.references, research.spatialLayout);

    const result = await generateImage({
      apiKey: context.apiKey,
      prompt,
      model: options.imageModel,
      aspectRatio: options.aspectRatio,
      referenceImageDataUrls: collectReferenceDataUrls(research.references),
    });

    return packageGenerationResult(result, {
      mode: research.mode,
      queries: research.targets.map((t) => t.query),
      references: research.references.map((r) => ({
        imageUrl: r.imageUrl,
        sourceUrl: r.sourceUrl,
        query: r.query,
        kind: r.kind,
        layer: r.layer,
        why: r.why,
        previewDataUrl: r.dataUrl,
        useFromImage: r.useFromImage,
        ignoreFromImage: r.ignoreFromImage,
      })),
      spatialLayout: research.spatialLayout,
    });
  }

  const selectedSectionObj = resolveSelectedSectionObj(
    effectiveMode,
    options.selectedSection,
    context.availableSections,
  );

  const basePrompt = buildImagePrompt(
    {
      flowTitle: context.flowTitle,
      flowPurpose: context.flowPurpose,
      agents: context.agents,
      finalOutput: effectiveMode === "featured" ? context.finalOutput : undefined,
      selectedSection: selectedSectionObj,
    },
    {
      userPrompt: options.userPrompt.trim() || undefined,
      includeText: options.includeText,
      includePeople: options.includePeople,
      includeAnimals: options.includeAnimals,
      includeCars: options.includeCars,
      isInfographic: options.isInfographic,
      aspectRatio: options.aspectRatio,
      style: options.style,
      colorScheme: options.colorScheme,
      colorForeground: options.colorForeground.trim() || undefined,
      colorBackground: options.colorBackground.trim() || undefined,
    },
  );

  const research = await researchGoogleImageReferences({
    apiKey: context.apiKey,
    model: getResearchModel(),
    context: {
      title: context.flowTitle,
      purpose: context.flowPurpose,
      sectionHeader: selectedSectionObj?.header,
      sectionContent: selectedSectionObj?.content,
      userPrompt: options.userPrompt,
      body: effectiveMode === "featured" ? context.finalOutput : selectedSectionObj?.fullText,
    },
  });

  const prompt =
    basePrompt +
    formatChecklistText(checklist) +
    "\n\nFollow the checklist above EXACTLY. Ensure all requirements are met, especially regarding what should and should NOT be included." +
    buildGroundedImagePromptSuffix(research.references);

  const result = await generateImage({
    apiKey: context.apiKey,
    prompt,
    model: options.imageModel,
    aspectRatio: options.aspectRatio,
    referenceImageDataUrls: collectReferenceDataUrls(research.references),
  });

  return packageGenerationResult(result, {
    mode: research.mode,
    queries: research.targets.map((t) => t.query),
    references: research.references.map((r) => ({
      imageUrl: r.imageUrl,
      sourceUrl: r.sourceUrl,
      query: r.query,
      kind: r.kind,
      layer: r.layer,
      why: r.why,
      previewDataUrl: r.dataUrl,
    })),
  });
}
