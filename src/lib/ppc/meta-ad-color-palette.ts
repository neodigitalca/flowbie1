import type { MetaAdColorPalette } from "@/lib/ppc/meta-ads-types";

export function normalizeMetaColorHex(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  let hex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex)) return undefined;
  if (hex.length === 4) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex.toLowerCase();
}

export function normalizeMetaColorPalette(raw?: MetaAdColorPalette | null): MetaAdColorPalette | undefined {
  if (!raw) return undefined;
  const background = normalizeMetaColorHex(raw.background);
  const accent = normalizeMetaColorHex(raw.accent);
  const primary = normalizeMetaColorHex(raw.primary);
  if (!background && !accent && !primary) return undefined;
  return {
    background,
    accent,
    primary,
  };
}

export function hasMetaColorPalette(palette?: MetaAdColorPalette | null): boolean {
  return Boolean(normalizeMetaColorPalette(palette));
}

export function formatMetaColorPaletteBlock(palette?: MetaAdColorPalette | null): string | null {
  const normalized = normalizeMetaColorPalette(palette);
  if (!normalized) return null;
  const parts: string[] = [];
  if (normalized.background) parts.push(`background ${normalized.background}`);
  if (normalized.accent) parts.push(`accent ${normalized.accent}`);
  if (normalized.primary) parts.push(`primary text ${normalized.primary}`);
  return `User color palette (use these hex values exactly): ${parts.join(", ")}`;
}

export function formatMetaColorPaletteBriefConstraint(palette?: MetaAdColorPalette | null): string | null {
  const block = formatMetaColorPaletteBlock(palette);
  if (!block) return null;
  return `${block}. Set backgroundTreatment to describe these exact colors. Do not substitute other hex values.`;
}
