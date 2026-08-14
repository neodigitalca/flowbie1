export type MetaAdImageReferenceSource = "dataforseo" | "flowbie-marketing";

export type MetaAdImageReferenceRole =
  | "layout"
  | "niche-subject"
  | "device"
  | "prop"
  | "scene"
  | "map"
  | "flowbie-marketing";

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
    case "flowbie-marketing":
      return "Flowbie marketing";
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
