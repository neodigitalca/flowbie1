export type MetaAdTypographyStyle =
  | "inter"
  | "montserrat"
  | "poppins"
  | "roboto"
  | "raleway"
  | "oswald"
  | "playfair-display";

export type MetaAdTypographyStyleOption = {
  id: MetaAdTypographyStyle;
  label: string;
  promptHint: string;
};

export const META_TYPOGRAPHY_STYLE_DEFAULT: MetaAdTypographyStyle = "inter";

export const META_TYPOGRAPHY_STYLES: MetaAdTypographyStyleOption[] = [
  { id: "inter", label: "Inter", promptHint: "Clean neutral sans-serif" },
  { id: "montserrat", label: "Montserrat", promptHint: "Bold geometric sans-serif" },
  { id: "poppins", label: "Poppins", promptHint: "Friendly rounded sans-serif" },
  { id: "roboto", label: "Roboto", promptHint: "Standard clean sans-serif" },
  { id: "raleway", label: "Raleway", promptHint: "Elegant light sans-serif" },
  { id: "oswald", label: "Oswald", promptHint: "Condensed display sans-serif" },
  {
    id: "playfair-display",
    label: "Playfair Display",
    promptHint: "Elegant serif headline",
  },
];

const STYLE_BY_ID = new Map(META_TYPOGRAPHY_STYLES.map((style) => [style.id, style]));

export function isMetaAdTypographyStyle(value: unknown): value is MetaAdTypographyStyle {
  return typeof value === "string" && STYLE_BY_ID.has(value as MetaAdTypographyStyle);
}

export function resolveMetaTypographyStyle(value: unknown): MetaAdTypographyStyle {
  return isMetaAdTypographyStyle(value) ? value : META_TYPOGRAPHY_STYLE_DEFAULT;
}

export function formatTypographyStyleForPrompt(style: MetaAdTypographyStyle | undefined): string | null {
  const resolved = resolveMetaTypographyStyle(style);
  const option = STYLE_BY_ID.get(resolved);
  if (!option) return null;
  return `Typography style: ${option.label} Google Font (${option.promptHint})`;
}
