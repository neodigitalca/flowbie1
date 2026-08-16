export type MetaAdImageReferenceSource = "dataforseo" | "neo-pulse-marketing";

export type MetaAdImageReferenceRole =
  | "layout"
  | "niche-subject"
  | "device"
  | "prop"
  | "scene"
  | "map"
  | "neo-pulse-marketing";

export type MetaAdImageReferenceSummary = {
  id: string;
  role: MetaAdImageReferenceRole;
  source: MetaAdImageReferenceSource;
  query: string;
  elementLabel?: string;
  imageUrl?: string;
  sourcePageUrl?: string;
  previewDataUrl?: string;
  visualDescription?: string;
  why?: string;
  useFromImage?: string[];
};

export function metaReferenceRoleLabel(role: MetaAdImageReferenceRole): string {
  switch (role) {
    case "neo-pulse-marketing":
      return "NEO Pulse marketing";
    case "niche-subject":
      return "Niche subject";
    case "device":
      return "Device";
    case "prop":
      return "Prop";
    case "scene":
      return "Scene";
    case "map":
      return "Map overlay";
    case "layout":
      return "Layout";
    default:
      return role;
  }
}
