import {
  collectReferenceDataUrls,
  researchGoogleImageReferences,
  type ImageGroundingTarget,
  type ImageReferenceResult,
} from "@/lib/image-reference-research";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import type { PpcWpPageContext } from "@/lib/ppc/google-ads-types";
import {
  buildMetaReferenceTargetsFromElements,
  metaVisualKindToReferenceRole,
  META_IMAGE_REF_MAX_TARGETS,
} from "@/lib/ppc/meta-ad-visual-reference-plan";
import type {
  MetaAdImageReferenceRole,
  MetaAdImageReferenceSummary,
} from "@/lib/ppc/meta-ad-image-reference-types";
import { loadNeoPulseMarketingAdReferenceFromBrief } from "@/lib/ppc/load-neo-pulse-marketing-ad-reference";
import type {
  MetaAdCreativeBrief,
  MetaAdPlacement,
  MetaAdVisualReferenceElement,
} from "@/lib/ppc/meta-ads-types";
import { metaAdPlacementLabel } from "@/lib/ppc/meta-ads-field-limits";

const COLLAGE_REJECTION =
  "REJECT blog roundups, ad example galleries, multi-ad collages, carousel screenshots, and pages titled ad examples.";

export function buildMetaInstagramLayoutAcceptanceBrief(allowPeopleInImage?: boolean): string {
  const lines = [
    "Must be ONE designed Instagram or Facebook feed/story sponsored ad creative.",
    allowPeopleInImage
      ? "Modern layout with bold type hierarchy and one short headline (6 words max)."
      : "Modern layout with bold type hierarchy and one short headline (6 words max). No people.",
    "REJECT literal prop collages, infographics, charts, and data visualization.",
    COLLAGE_REJECTION,
    "REJECT watermarks, Instagram app UI screenshots, paragraph body text in the image.",
  ];
  if (!allowPeopleInImage) {
    lines.push("REJECT images with people, faces, or human silhouettes.");
  }
  return lines.join(" ");
}

export function buildMetaInstagramNicheAcceptanceBrief(allowPeopleInImage?: boolean): string {
  const lines = [
    allowPeopleInImage
      ? "Must be a clear professional lifestyle or product photo on white or light background."
      : "Must be a clear professional product or environment photo on white or light background. No people.",
    "Single subject scene suitable as the hero photo inside an Instagram ad.",
    "REJECT dark backgrounds, neon graphics, text-heavy ads, infographics, charts, collages, and multi-image galleries.",
    COLLAGE_REJECTION,
  ];
  if (!allowPeopleInImage) {
    lines.push("REJECT images with people, faces, or human silhouettes.");
  }
  return lines.join(" ");
}

export function buildMetaInstagramLayoutQuery(placement: MetaAdPlacement): string {
  if (placement === "story_9x16") {
    return "instagram story sponsored ad graphic design bold typography";
  }
  return "instagram feed sponsored ad graphic design bold typography";
}

export function buildMetaInstagramNicheSubjectQuery(
  nicheLabel: string,
  allowPeopleInImage?: boolean,
): string {
  if (allowPeopleInImage) {
    return `${nicheLabel.trim()} lifestyle photo white background professional`;
  }
  return `${nicheLabel.trim()} product photo white background professional no people`;
}

export function resolveMetaNicheSubjectLabel(
  focusKeyword?: string,
  landingPage?: PpcWpPageContext,
): string {
  return (
    focusKeyword?.trim() ||
    landingPage?.keyword?.trim() ||
    landingPage?.title?.trim() ||
    ""
  );
}

export function inferMetaReferenceRole(ref: ImageReferenceResult): MetaAdImageReferenceRole {
  if (/google maps|local search|map pin/i.test(ref.query)) return "map";
  if (/lifestyle photo|product photo/i.test(ref.query)) return "niche-subject";
  if (/\b20\d{2}\b.*(macbook|ipad|iphone|laptop|tablet|monitor)/i.test(ref.query)) return "device";
  return "layout";
}

export function referenceSummaryHasRealWorldRole(
  summaries: MetaAdImageReferenceSummary[],
): boolean {
  return summaries.some((ref) =>
    ref.role === "niche-subject" ||
    ref.role === "device" ||
    ref.role === "prop" ||
    ref.role === "scene" ||
    ref.role === "map",
  );
}

function resolveReferenceElement(
  ref: ImageReferenceResult,
  referenceElements?: MetaAdVisualReferenceElement[],
): MetaAdVisualReferenceElement | undefined {
  if (!referenceElements?.length) return undefined;
  return referenceElements.find(
    (element) =>
      element.googleImageQuery === ref.query ||
      element.label === ref.role ||
      ref.query.includes(element.googleImageQuery) ||
      element.googleImageQuery.includes(ref.query),
  );
}

export function buildMetaInstagramReferenceTargets(options: {
  placement: MetaAdPlacement;
  nicheSubjectLabel?: string;
  includeLayoutTarget?: boolean;
  includeNicheTarget?: boolean;
  allowPeopleInImage?: boolean;
}): ImageGroundingTarget[] {
  const allowPeople = options.allowPeopleInImage === true;
  const targets: ImageGroundingTarget[] = [];
  if (options.includeLayoutTarget !== false) {
    targets.push({
      kind: "other",
      query: buildMetaInstagramLayoutQuery(options.placement),
      role: "instagram ad layout",
      acceptanceBrief: buildMetaInstagramLayoutAcceptanceBrief(allowPeople),
      pickCount: 1,
    });
  }
  const nicheLabel = options.nicheSubjectLabel?.trim();
  if (options.includeNicheTarget !== false && nicheLabel) {
    targets.push({
      kind: "other",
      query: buildMetaInstagramNicheSubjectQuery(nicheLabel, allowPeople),
      role: "niche subject photo",
      acceptanceBrief: buildMetaInstagramNicheAcceptanceBrief(allowPeople),
      pickCount: 1,
    });
  }
  return targets;
}

export function buildMetaInstagramReferenceTargetsFromQueries(options: {
  referenceQueries?: string[];
  placement: MetaAdPlacement;
  nicheSubjectLabel?: string;
  includeLayoutTarget?: boolean;
  includeNicheTarget?: boolean;
  allowPeopleInImage?: boolean;
}): ImageGroundingTarget[] {
  const queries = (options.referenceQueries ?? []).map((query) => query.trim()).filter(Boolean);
  if (queries.length) {
    return queries.slice(0, 4).map((query, index) => ({
      kind: "other" as const,
      query,
      role: index === 0 ? "instagram ad layout" : "niche subject photo",
      acceptanceBrief:
        index === 0
          ? buildMetaInstagramLayoutAcceptanceBrief(options.allowPeopleInImage)
          : buildMetaInstagramNicheAcceptanceBrief(options.allowPeopleInImage),
      pickCount: 1,
    }));
  }
  return buildMetaInstagramReferenceTargets(options);
}

/** @deprecated Use buildMetaInstagramLayoutQuery */
export function buildMetaInstagramReferenceQuery(
  placement: MetaAdPlacement,
  _focusKeyword?: string,
): string {
  return buildMetaInstagramLayoutQuery(placement);
}

/** @deprecated Use buildMetaInstagramLayoutAcceptanceBrief */
export function buildMetaInstagramReferenceAcceptanceBrief(): string {
  return buildMetaInstagramLayoutAcceptanceBrief();
}

export function buildMetaInstagramReferencePromptSuffix(
  references: ImageReferenceResult[],
  referenceElements?: MetaAdVisualReferenceElement[],
  creativeBrief?: MetaAdCreativeBrief,
): string {
  if (!references.length) return "";
  const lines = references.map((ref, index) => {
    const matched = resolveReferenceElement(ref, referenceElements);
    const role = matched
      ? metaVisualKindToReferenceRole(matched.kind)
      : inferMetaReferenceRole(ref);
    const roleLabel = matched
      ? `${matched.label} ref`
      : role === "niche-subject"
        ? "Niche subject ref"
        : role === "device"
          ? "Device ref"
          : role === "prop"
            ? "Prop ref"
            : role === "scene"
              ? "Scene ref"
              : role === "map"
                ? "Map overlay ref"
                : "Layout ref";
    const head = `- ${roleLabel} Ref[${index}] (query="${ref.query}"): ${ref.visualDescription || ref.why || "Reference"}`;
    const use = (ref.useFromImage ?? []).filter(Boolean);
    const ignore = (ref.ignoreFromImage ?? []).filter(Boolean);
    const extra: string[] = [head];
    if (matched?.acceptanceBrief) extra.push(`  Must satisfy: ${matched.acceptanceBrief}`);
    if (ref.sourceUrl) extra.push(`  Source: ${ref.sourceUrl}`);
    if (use.length) extra.push(`  USE: ${use.join("; ")}`);
    if (ignore.length) extra.push(`  IGNORE: ${ignore.join("; ")}`);
    return extra.join("\n");
  });
  const hasSubjectRef = references.some((ref) => {
    const matched = resolveReferenceElement(ref, referenceElements);
    const role = matched ? metaVisualKindToReferenceRole(matched.kind) : inferMetaReferenceRole(ref);
    return (
      role === "niche-subject" ||
      role === "device" ||
      role === "prop" ||
      role === "scene" ||
      role === "map"
    );
  });
  const hasDeviceRef = references.some((ref) => {
    const matched = resolveReferenceElement(ref, referenceElements);
    const role = matched ? metaVisualKindToReferenceRole(matched.kind) : inferMetaReferenceRole(ref);
    return role === "device";
  });
  const hasMapRef = references.some((ref) => {
    const matched = resolveReferenceElement(ref, referenceElements);
    const role = matched ? metaVisualKindToReferenceRole(matched.kind) : inferMetaReferenceRole(ref);
    return role === "map";
  });
  return [
    "",
    "INSTAGRAM AD REFERENCES (attached photos):",
    "Generate ONE designed Instagram feed/story sponsored ad creative.",
    creativeBrief
      ? `Background treatment: ${creativeBrief.backgroundTreatment}. Visual vibe: ${creativeBrief.visualVibe}.`
      : "",
    hasSubjectRef
      ? "Supporting visual must match labeled device, prop, scene, or map refs. Layout and type hierarchy must match the layout ref."
      : "Layout and on-image text density must match the marketing layout ref.",
    hasMapRef && creativeBrief?.useMapOverlay
      ? "Composite the map ref as a subtle designed overlay when brief allows."
      : "",
    hasDeviceRef
      ? "Match device refs for hardware shape. Screen shows realistic page-builder or site layout with placeholder blocks only, no readable text."
      : "",
    "Do not copy watermarks, profile names, Sponsored labels, or Instagram UI chrome from references.",
    ...lines,
  ]
    .filter(Boolean)
    .join("\n");
}

export function summarizeMetaInstagramReferences(
  references: ImageReferenceResult[],
  referenceElements?: MetaAdVisualReferenceElement[],
): MetaAdImageReferenceSummary[] {
  return references.map((ref, index) => {
    const matched = resolveReferenceElement(ref, referenceElements);
    const role = matched
      ? metaVisualKindToReferenceRole(matched.kind)
      : inferMetaReferenceRole(ref);
    return {
      id: `ref-${index + 1}`,
      role,
      source: "dataforseo",
      query: ref.query,
      elementLabel: matched?.label,
      imageUrl: ref.imageUrl,
      sourcePageUrl: ref.sourceUrl,
      previewDataUrl: ref.dataUrl,
      visualDescription: ref.visualDescription,
      why: ref.why,
      useFromImage: ref.useFromImage,
    };
  });
}

export type MetaInstagramReferenceResult = {
  references: ImageReferenceResult[];
  referenceSummaries: MetaAdImageReferenceSummary[];
  referenceDataUrls: string[];
  promptSuffix: string;
  hasNicheSubjectRef: boolean;
  referenceElements?: MetaAdVisualReferenceElement[];
};

/** Instagram reference agent */
export async function runMetaAdInstagramReferenceAgent(options: {
  apiKey: string;
  model?: string;
  siteId?: string;
  placement: MetaAdPlacement;
  focusKeyword?: string;
  userFocusKeyword?: string;
  landingPage?: PpcWpPageContext;
  creativeBrief: MetaAdCreativeBrief;
  visualDirection?: string;
  referenceQueries?: string[];
  referenceElements?: MetaAdVisualReferenceElement[];
  allowPeopleInImage?: boolean;
  signal?: AbortSignal;
}): Promise<MetaInstagramReferenceResult> {
  if (options.signal?.aborted) {
    throw new Error("Generation cancelled");
  }
  if (!options.creativeBrief) {
    throw new Error("Creative brief is required for image reference fetch.");
  }

  const referenceElements = options.referenceElements;
  if (!referenceElements?.length) {
    throw new Error("Visual reference plan elements are required for image reference fetch.");
  }

  const marketingLayoutRef = await loadNeoPulseMarketingAdReferenceFromBrief(options.creativeBrief);
  if (!marketingLayoutRef?.dataUrl) {
    throw new Error("Marketing layout reference image is required but could not be loaded.");
  }

  const references: ImageReferenceResult[] = [marketingLayoutRef];
  const isDesignedGraphic = options.creativeBrief.creativeStyle !== "photo_hero";
  const supplementalElements = isDesignedGraphic
    ? referenceElements.filter((element) => element.kind !== "layout")
    : referenceElements;

  if (supplementalElements.length) {
    const forcedTargets = buildMetaReferenceTargetsFromElements(
      supplementalElements,
      options.allowPeopleInImage,
    );

    if (forcedTargets.length) {
      const researchModel = options.model || getResearchModel(options.siteId);
      const { references: dfsReferences } = await researchGoogleImageReferences({
        apiKey: options.apiKey,
        model: researchModel,
        context: {
          purpose: "Meta Instagram ad creative reference (DataForSEO Google Images)",
          userPrompt: [
            metaAdPlacementLabel(options.placement),
            options.creativeBrief.visualConcept,
            options.creativeBrief.backgroundTreatment,
            options.visualDirection?.trim(),
          ]
            .filter(Boolean)
            .join(" · "),
        },
        forcedTargets,
        requireReferences: !isDesignedGraphic,
        maxReferencesPerTarget: 1,
        maxTargets: META_IMAGE_REF_MAX_TARGETS,
      });

      for (const ref of dfsReferences) {
        if (references.some((existing) => existing.imageUrl === ref.imageUrl)) continue;
        references.push(ref);
      }
    }
  }

  if (isDesignedGraphic && references.length < 1) {
    throw new Error("Marketing layout reference is required for designed graphic creatives.");
  }

  if (!isDesignedGraphic && !referenceSummaryHasRealWorldRole(summarizeMetaInstagramReferences(references, referenceElements))) {
    throw new Error("No real-world reference images found for photo_hero ad.");
  }

  const referenceSummaries = summarizeMetaInstagramReferences(references, referenceElements);
  const hasNicheSubjectRef = referenceSummaryHasRealWorldRole(referenceSummaries);

  return {
    references,
    referenceSummaries,
    referenceDataUrls: collectReferenceDataUrls(references),
    promptSuffix: buildMetaInstagramReferencePromptSuffix(references, referenceElements, options.creativeBrief),
    hasNicheSubjectRef,
    referenceElements,
  };
}
