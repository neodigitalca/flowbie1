import type { ImageGroundingTarget } from "@/lib/image-reference-research";
import type {
  MetaAdContextSource,
  MetaAdCreativeBrief,
  MetaAdCreativeMode,
  MetaAdVisualReferenceElement,
  MetaAdVisualReferenceKind,
} from "@/lib/ppc/meta-ads-types";
import {
  META_VISUAL_TOOL_PALETTE_PROMPT,
} from "@/lib/ppc/meta-ad-visual-tool-palette";

export const META_IMAGE_REF_MAX_TARGETS = 5;

const VALID_KINDS = new Set<MetaAdVisualReferenceKind>(["layout", "device", "prop", "scene", "map"]);

export const META_REAL_WORLD_REFERENCE_KINDS = new Set<MetaAdVisualReferenceKind>([
  "prop",
  "scene",
  "map",
  "device",
]);

export function getMetaReferencePlanYear(): number {
  return new Date().getFullYear();
}

export function metaTopicRequiresMapElement(options: {
  creativeBrief?: MetaAdCreativeBrief;
  focusKeyword?: string;
  primaryTopic?: string;
  creativeMode?: MetaAdCreativeMode;
}): boolean {
  if (options.creativeBrief) {
    return options.creativeBrief.useMapOverlay === true;
  }
  return false;
}

function defaultAcceptanceForKind(
  kind: MetaAdVisualReferenceKind,
  allowPeopleInImage?: boolean,
): string {
  if (kind === "layout") {
    return allowPeopleInImage
      ? "Must read as a designed Instagram sponsored post ad with bold type hierarchy."
      : "Must read as a designed Instagram sponsored post ad. No people or faces.";
  }
  if (kind === "scene") {
    return allowPeopleInImage
      ? "Must support the brief visual concept as a single focal graphic element."
      : "Must support the brief visual concept. No people or faces.";
  }
  if (kind === "device") {
    return "Must show accurate current-model hardware with correct proportions. Device screen uses abstract color blocks and geometric shapes only, no readable text or logos.";
  }
  if (kind === "map") {
    return "Must show Google Maps or local search UI suitable as a designed overlay when brief allows.";
  }
  return "Must clearly show the named supporting visual for a designed Instagram ad.";
}

function ensureDeviceQueryHasYear(query: string, year: number): string {
  const trimmed = query.trim();
  if (!trimmed) return trimmed;
  if (/\b20\d{2}\b/.test(trimmed)) return trimmed;
  return `${year} ${trimmed}`;
}

function normalizeElement(
  raw: unknown,
  index: number,
  year: number,
): MetaAdVisualReferenceElement | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as {
    id?: string;
    label?: string;
    kind?: string;
    googleImageQuery?: string;
    query?: string;
    acceptanceBrief?: string;
    pickCount?: number;
  };
  const label = row.label?.trim();
  const kind = row.kind?.trim() as MetaAdVisualReferenceKind | undefined;
  let googleImageQuery = row.googleImageQuery?.trim() || row.query?.trim() || "";
  const acceptanceBrief = row.acceptanceBrief?.trim();
  if (!label || !kind || !VALID_KINDS.has(kind) || !googleImageQuery || !acceptanceBrief) {
    return null;
  }
  if (kind === "device") {
    googleImageQuery = ensureDeviceQueryHasYear(googleImageQuery, year);
  }
  const pickCount =
    typeof row.pickCount === "number" && row.pickCount >= 1
      ? Math.floor(row.pickCount)
      : undefined;
  return {
    id: row.id?.trim() || `element-${index + 1}`,
    label,
    kind,
    googleImageQuery,
    acceptanceBrief,
    pickCount,
  };
}

function describeRawKeys(raw: unknown): string {
  if (!raw || typeof raw !== "object") return typeof raw;
  return Object.keys(raw as Record<string, unknown>).join(", ") || "empty object";
}

export function extractVisualReferenceElements(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  const root = raw as Record<string, unknown>;
  for (const key of ["elements", "visualElements", "referenceElements"] as const) {
    if (Array.isArray(root[key])) return root[key] as unknown[];
  }
  const plan = root.plan;
  if (plan && typeof plan === "object") {
    const nested = plan as Record<string, unknown>;
    for (const key of ["elements", "visualElements", "referenceElements"] as const) {
      if (Array.isArray(nested[key])) return nested[key] as unknown[];
    }
  }
  return [];
}

export function validateVisualReferencePlan(
  _elements: MetaAdVisualReferenceElement[],
  _options?: {
    creativeBrief?: MetaAdCreativeBrief;
    focusKeyword?: string;
    primaryTopic?: string;
    creativeMode?: MetaAdCreativeMode;
    localityCity?: string;
  },
): void {}

export function parseMetaVisualReferencePlan(
  raw: unknown,
  year = getMetaReferencePlanYear(),
  options?: {
    creativeBrief?: MetaAdCreativeBrief;
    focusKeyword?: string;
    primaryTopic?: string;
    creativeMode?: MetaAdCreativeMode;
    localityCity?: string;
  },
): MetaAdVisualReferenceElement[] {
  const source = extractVisualReferenceElements(raw);
  if (!source.length) {
    throw new Error(`Visual reference plan returned no elements (keys: ${describeRawKeys(raw)}).`);
  }
  const elements = source
    .map((item, index) => normalizeElement(item, index, year))
    .filter((item): item is MetaAdVisualReferenceElement => Boolean(item));
  if (!elements.length) {
    throw new Error("Visual reference plan returned no valid elements.");
  }
  const trimmed = elements.slice(0, META_IMAGE_REF_MAX_TARGETS);
  validateVisualReferencePlan(trimmed, options);
  return trimmed;
}

export function buildMetaReferenceTargetsFromElements(
  elements: MetaAdVisualReferenceElement[],
  allowPeopleInImage?: boolean,
): ImageGroundingTarget[] {
  return elements.slice(0, META_IMAGE_REF_MAX_TARGETS).map((element) => ({
    kind: "other" as const,
    query: element.googleImageQuery,
    role: element.label,
    acceptanceBrief: element.acceptanceBrief || defaultAcceptanceForKind(element.kind, allowPeopleInImage),
    pickCount: element.pickCount ?? 1,
  }));
}

export function buildVisualReferencePlanMarkdown(elements: MetaAdVisualReferenceElement[]): string {
  return [
    "# Visual reference plan",
    "",
    ...elements.flatMap((element) => [
      `## ${element.label}`,
      `- Kind: ${element.kind}`,
      `- Google Images query: ${element.googleImageQuery}`,
      `- Acceptance: ${element.acceptanceBrief}`,
      "",
    ]),
  ].join("\n");
}

export function buildMetaVisualReferencePlanSystemPrompt(options?: {
  contextSource?: MetaAdContextSource;
  creativeMode?: MetaAdCreativeMode;
  creativeBrief?: MetaAdCreativeBrief;
}): string {
  const brief = options?.creativeBrief;
  const isDesignedGraphic = !brief || brief.creativeStyle !== "photo_hero";
  const isFlowbieProduct =
    options?.contextSource === "flowbie_app" || options?.creativeMode === "product_saas";
  const flowbieRules = isFlowbieProduct
    ? `

FlowbieONE product ad rules (critical):
- Plan reference searches for tools in creativeBrief.visualToolPalette where degree > 0.
- Read programBrief in the user payload for reference ad patterns.
- Map element only when map_overlay.degree > 0 or creativeBrief.useMapOverlay is true.`
    : "";

  const styleRules = isDesignedGraphic
    ? `Default creativeStyle is designed_graphic:
- Read creativeBrief.visualToolPalette. Plan Google Images refs for tools where degree > 0.
- Map tool keys to reference element kinds (internal kind field only):
  typography, gradient_panel → layout refs (composition, type hierarchy)
  icon_cluster, accent_shapes → prop refs (icons, shapes, motifs)
  city_skyline → scene refs (skyline, cityscape)
  device_screen → device refs (hardware vignette)
  map_overlay → map refs (only when degree > 0 or useMapOverlay)
  photo_focal → prop or scene refs (photo hero subject)
- No required layout element. OpenRouter decides which active tools get refs this run.`
    : `creativeStyle is photo_hero:
- Plan refs for tools in visualToolPalette where degree > 0, especially photo_focal.
- Map element only when map_overlay.degree > 0 or useMapOverlay is true`;

  return `You are a Meta ad visual reference planner.

Break the creative brief visual concept into separate Google Images searches, one per visual element.
Return ONLY valid JSON with a top-level "elements" array matching outputSchema.

${META_VISUAL_TOOL_PALETTE_PROMPT}

${styleRules}

Tool-to-reference mapping (use tool names in reasoning; output kind for grounding):
- typography / gradient_panel → kind layout when degree > 0
- icon_cluster / accent_shapes → kind prop when degree > 0
- city_skyline → kind scene when degree > 0
- device_screen → kind device when degree > 0
- map_overlay → kind map when degree > 0 and brief allows maps
- photo_focal → kind prop or scene when degree > 0

Query rules (critical):
- Target Instagram feed ad graphic design references matching active tools and their degrees.
- Example typography/layout query: "instagram feed sponsored ad graphic design bold typography icons shapes"
- Example icon_cluster query: "SEO search icons flat design"
- For device elements, googleImageQuery MUST include currentYear from the user payload.

Each element needs a clear acceptanceBrief stating what must be visible in the picked reference.${flowbieRules}`;
}

export function buildMetaVisualReferencePlanUserPayload(options: {
  creativeBrief: MetaAdCreativeBrief;
  goal: {
    visualDirection: string;
    primaryTopic: string;
    creativeMode?: MetaAdCreativeMode;
  };
  placement: string;
  placementLabel: string;
  focusKeyword?: string;
  currentYear: number;
  contextSource?: MetaAdContextSource;
  programBrief?: string;
  localityCity?: string;
}): string {
  return JSON.stringify({
    task: "meta_ad_visual_reference_plan",
    currentYear: options.currentYear,
    placement: options.placement,
    placementLabel: options.placementLabel,
    focusKeyword: options.focusKeyword?.trim() || "",
    localityCity: options.localityCity?.trim() || "",
    contextSource: options.contextSource ?? "custom",
    programBrief: options.programBrief?.trim() || "",
    creativeBrief: options.creativeBrief,
    goal: options.goal,
    outputSchema: {
      elements: [
        {
          id: "string",
          label: "string",
          kind: "layout | device | prop | scene | map",
          googleImageQuery: "string",
          acceptanceBrief: "string",
          pickCount: 1,
        },
      ],
    },
  });
}

export function metaVisualKindToReferenceRole(
  kind: MetaAdVisualReferenceKind,
): "layout" | "device" | "prop" | "scene" | "map" | "niche-subject" {
  if (kind === "layout") return "layout";
  if (kind === "device") return "device";
  if (kind === "prop") return "prop";
  if (kind === "scene") return "scene";
  if (kind === "map") return "map";
  return "niche-subject";
}

export function isMetaRealWorldReferenceKind(kind: MetaAdVisualReferenceKind): boolean {
  return META_REAL_WORLD_REFERENCE_KINDS.has(kind);
}
