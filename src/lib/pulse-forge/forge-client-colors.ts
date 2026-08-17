export type ForgeClientColor = {
  borderClass: string;
  textClass: string;
  swatchClass: string;
};

const FORGE_CLIENT_COLOR_PALETTE: ForgeClientColor[] = [
  {
    borderClass: "border-l-primary",
    textClass: "text-primary",
    swatchClass: "bg-primary",
  },
  {
    borderClass: "border-l-[hsl(var(--semantic-data))]",
    textClass: "text-[hsl(var(--semantic-data-foreground))]",
    swatchClass: "bg-[hsl(var(--semantic-data))]",
  },
  {
    borderClass: "border-l-[hsl(var(--semantic-warning))]",
    textClass: "text-[hsl(var(--semantic-warning-foreground))]",
    swatchClass: "bg-[hsl(var(--semantic-warning))]",
  },
  {
    borderClass: "border-l-[hsl(var(--semantic-publish))]",
    textClass: "text-[hsl(var(--semantic-publish-foreground))]",
    swatchClass: "bg-[hsl(var(--semantic-publish))]",
  },
  {
    borderClass: "border-l-[hsl(280_65%_58%)]",
    textClass: "text-[hsl(280_65%_72%)]",
    swatchClass: "bg-[hsl(280_65%_58%)]",
  },
  {
    borderClass: "border-l-[hsl(12_78%_58%)]",
    textClass: "text-[hsl(12_78%_68%)]",
    swatchClass: "bg-[hsl(12_78%_58%)]",
  },
  {
    borderClass: "border-l-[hsl(200_85%_55%)]",
    textClass: "text-[hsl(200_85%_68%)]",
    swatchClass: "bg-[hsl(200_85%_55%)]",
  },
  {
    borderClass: "border-l-[hsl(330_75%_58%)]",
    textClass: "text-[hsl(330_75%_72%)]",
    swatchClass: "bg-[hsl(330_75%_58%)]",
  },
  {
    borderClass: "border-l-[hsl(45_90%_52%)]",
    textClass: "text-[hsl(45_90%_65%)]",
    swatchClass: "bg-[hsl(45_90%_52%)]",
  },
  {
    borderClass: "border-l-[hsl(160_70%_42%)]",
    textClass: "text-[hsl(160_70%_58%)]",
    swatchClass: "bg-[hsl(160_70%_42%)]",
  },
  {
    borderClass: "border-l-[hsl(0_72%_55%)]",
    textClass: "text-[hsl(0_72%_68%)]",
    swatchClass: "bg-[hsl(0_72%_55%)]",
  },
  {
    borderClass: "border-l-[hsl(220_55%_62%)]",
    textClass: "text-[hsl(220_55%_74%)]",
    swatchClass: "bg-[hsl(220_55%_62%)]",
  },
];

export function resolveForgeClientColorKey(siteId?: string, siteName?: string): string {
  return (siteId?.trim() || siteName?.trim() || "").toLowerCase();
}

export function forgeClientColor(siteId?: string, siteName?: string): ForgeClientColor {
  const key = resolveForgeClientColorKey(siteId, siteName);
  if (!key) return FORGE_CLIENT_COLOR_PALETTE[0];
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % 9973;
  }
  return FORGE_CLIENT_COLOR_PALETTE[hash % FORGE_CLIENT_COLOR_PALETTE.length] ?? FORGE_CLIENT_COLOR_PALETTE[0];
}

export const FORGE_CLIENT_TILE_ACCENT_WIDTH_CLASS = "border-l-[length:var(--tile-accent-width)]";

const assignedClientColorIndex = new Map<string, number>();
let nextClientColorIndex = 0;

/** Stable unique palette slot per site key (id or name), no hash collisions. */
export function forgeClientColorUnique(siteId?: string, siteName?: string): ForgeClientColor {
  const key = resolveForgeClientColorKey(siteId, siteName);
  if (!key) return FORGE_CLIENT_COLOR_PALETTE[0];
  let slot = assignedClientColorIndex.get(key);
  if (slot == null) {
    slot = nextClientColorIndex % FORGE_CLIENT_COLOR_PALETTE.length;
    assignedClientColorIndex.set(key, slot);
    nextClientColorIndex += 1;
  }
  return FORGE_CLIENT_COLOR_PALETTE[slot] ?? FORGE_CLIENT_COLOR_PALETTE[0];
}

export function primeForgeClientColors(siteKeys: string[]): void {
  for (const key of siteKeys) {
    const normalized = key.trim().toLowerCase();
    if (!normalized || assignedClientColorIndex.has(normalized)) continue;
    assignedClientColorIndex.set(normalized, nextClientColorIndex % FORGE_CLIENT_COLOR_PALETTE.length);
    nextClientColorIndex += 1;
  }
}
