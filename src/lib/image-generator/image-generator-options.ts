import type { AgentConfig } from "@/types/agent-config";
import type { MarkdownSection } from "@/lib/section-parser";
import type { ImageChecklistItem } from "@/lib/image-checklist-builder";
import type { ManualImageReference } from "@/lib/image-generator/manual-reference-upload";

export type ImageSourceMode = "featured" | "section" | "solo";

export type ImageAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "21:9" | "9:19";

export type ImageStyle = "professional" | "minimalist" | "abstract" | "modern" | "classic";

export type ImageColorScheme = "vibrant" | "muted" | "monochrome" | "warm" | "cool" | "natural";

export type ImageGeneratorOptions = {
  userPrompt: string;
  imageSourceMode: ImageSourceMode;
  selectedSection: string | null;
  includeText: boolean;
  includePeople: boolean;
  includeAnimals: boolean;
  includeCars: boolean;
  isInfographic: boolean;
  aspectRatio: ImageAspectRatio;
  style: ImageStyle;
  colorScheme: ImageColorScheme;
  colorForeground: string;
  colorBackground: string;
  imageModel: string;
  /** User-uploaded references; when present, auto Google Images research is skipped. */
  manualReferences?: ManualImageReference[];
};

export type ImageGeneratorRunContext = {
  apiKey: string;
  flowTitle: string;
  flowPurpose: string;
  agents: AgentConfig[];
  finalOutput: string;
  selectedModel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  availableSections: MarkdownSection[];
};

export type ImageGenerationResult = {
  imageUrl: string | null;
  imageBase64: string | null;
  previewUrl: string | null;
  error: string | null;
  /** Google Images reference provenance for Image Generator testing. */
  referenceResearch?: {
    mode: "abstract" | "grounded";
    queries: string[];
    references: Array<{
      imageUrl: string;
      sourceUrl?: string;
      query: string;
      kind: string;
      layer?: string;
      why: string;
      previewDataUrl?: string;
      useFromImage?: string[];
      ignoreFromImage?: string[];
    }>;
    spatialLayout?: string;
  };
};

export function resolveEffectiveSourceMode(
  imageSourceMode: ImageSourceMode,
  selectedSection: string | null,
): ImageSourceMode {
  if (imageSourceMode === "solo") return "solo";
  return imageSourceMode === "section" && !selectedSection ? "featured" : imageSourceMode;
}

export function resolveSelectedSectionObj(
  effectiveMode: ImageSourceMode,
  selectedSection: string | null,
  availableSections: MarkdownSection[],
) {
  if (effectiveMode !== "section" || !selectedSection) return undefined;
  return availableSections.find((s) => s.header === selectedSection);
}

/** Keyword prompt for Solo mode. Prefer attached Google Images refs when present. */
export function buildSoloImagePrompt(
  keyword: string,
  options: Pick<
    ImageGeneratorOptions,
    | "includeText"
    | "includePeople"
    | "includeAnimals"
    | "includeCars"
    | "isInfographic"
    | "colorForeground"
    | "colorBackground"
  >,
  hasReferencePhotos: boolean,
  relaxSafetyConstraints = false,
): string {
  const parts: string[] = [
    `Create a photorealistic image of: ${keyword.trim()}.`,
    "Depict only what the keyword names.",
    "Do not invent extra landmarks, vehicles, trains, LRT, streetcars, neon lighting, dramatic sunsets, crowds, or other details not implied by the keyword.",
    "Use natural, realistic color and lighting. Do not oversaturate.",
  ];

  if (hasReferencePhotos) {
    parts.push(
      "Attached Google Images references are evidence for one scene: subject identity vs place setting — not collage layers.",
      "Do not cut, mesh, paste, or composite a subject photo onto a place photo. Rebuild one coherent photograph as if one camera shot the whole scene (matched lighting, perspective, shadows, ground contact).",
      "Never reproduce photo chrome from refs.",
      "Compose a single coherent photograph that makes physical sense. Put the foreground subject at this exact named place from the place refs when place refs exist.",
      "PLACE MATCH: the final setting must be that place's real interior or exterior from the place refs — not a generic lookalike with a logo. Match floor zones, wall finishes, ceiling, fixed equipment layout/colors, and branding when place refs are interiors.",
      "Building/room and location must stay together. Match layout and barriers/railings/fencing from place refs.",
      "Only show architecture and room sections that appear in the place refs. Never invent, mirror, or extend architecture past the reference photo edges.",
      "Match the true ground/floor type from place refs: parking lot stays a parking lot; turf/rubber zones stay as shown.",
      "Multiple product refs (side, close-up, lifestyle) describe ONE product — do not collage several variants into one frame.",
      "Do not invent concrete jersey barriers or dividers not visible in place refs. Do not collage. Do not invent businesses or landmarks not named in the keyword.",
    );
  }

  const include: string[] = [];
  if (options.includeText) include.push("text elements");
  if (options.includePeople) include.push("people");
  if (options.includeAnimals) include.push("animals");
  if (options.includeCars) include.push("vehicles");
  if (include.length) parts.push(`Include: ${include.join(", ")}.`);

  if (options.isInfographic) {
    parts.push("Image type: infographic with clear labels and visual structure.");
  }

  const fg = options.colorForeground.trim();
  const bg = options.colorBackground.trim();
  if (fg) parts.push(`Foreground color preference: ${fg}.`);
  if (bg) parts.push(`Background color preference: ${bg}.`);

  if (!relaxSafetyConstraints) {
    if (!options.includePeople && !options.includeAnimals) {
      if (hasReferencePhotos) {
        parts.push(
          "Do not invent animals unless the keyword names them.",
          "Do not include people or animals unless the keyword requires them — ignore incidental people in reference photos when the keyword does not ask for them.",
        );
      } else {
        parts.push("Do not include people or animals.");
      }
    }
    if (!options.includeText && !options.isInfographic) {
      if (hasReferencePhotos) {
        parts.push(
          "No invented text, watermarks, or UI chrome. Place branding/signage that appears in place refs and identifies the place may appear as in those refs.",
        );
      } else {
        parts.push(
          "Absolutely no text, logos, letters, numbers, watermarks, or written content in the image.",
        );
      }
    }
  }
  if (!options.includeCars) {
    parts.push(
      "Do not invent trains, LRT, streetcars, or transit unless the keyword names them.",
    );
  }

  return parts.join(" ");
}

export function formatChecklistText(checklist: ImageChecklistItem[]): string {
  if (checklist.length === 0) return "";
  return `\n\nImage Generation Checklist:\n${checklist
    .map((item, idx) => `${idx + 1}. ${item.title}\n   ${item.description}`)
    .join("\n")}`;
}
