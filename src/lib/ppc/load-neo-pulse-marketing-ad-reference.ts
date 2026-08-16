import type { ImageReferenceResult } from "@/lib/image-reference-research";
import type { MetaAdCreativeBrief } from "@/lib/ppc/meta-ads-types";

export const NEO_PULSE_MARKETING_AD_FILES = {
  bofuActionList: "ad-01-bofu-action-list.png",
  bofuWordpress: "ad-02-bofu-wordpress-connected.png",
  mofuAgency: "ad-03-mofu-agency-scale.png",
  mofuEnterprise: "ad-04-mofu-enterprise-flows.png",
  tofuLocal: "ad-05-tofu-local-search.png",
  tofuAwareness: "ad-06-tofu-awareness.png",
} as const;

const DEFAULT_NEO_PULSE_MARKETING_AD = NEO_PULSE_MARKETING_AD_FILES.bofuActionList;

export function resolveNeoPulseMarketingAdFilename(referenceAdPattern?: string): string {
  const pattern = referenceAdPattern?.trim();
  if (!pattern) return DEFAULT_NEO_PULSE_MARKETING_AD;
  const filenames = Object.values(NEO_PULSE_MARKETING_AD_FILES);
  if (filenames.includes(pattern as (typeof filenames)[number])) {
    return pattern;
  }
  const withPng = pattern.endsWith(".png") ? pattern : `${pattern}.png`;
  if (filenames.includes(withPng as (typeof filenames)[number])) {
    return withPng;
  }
  return DEFAULT_NEO_PULSE_MARKETING_AD;
}

function marketingAdPublicUrl(filename: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}marketing/instagram-ads/${filename}`;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read marketing ad image"));
    reader.readAsDataURL(blob);
  });
}

export async function loadNeoPulseMarketingAdReference(
  filename: string = DEFAULT_NEO_PULSE_MARKETING_AD,
): Promise<ImageReferenceResult | null> {
  const imageUrl = marketingAdPublicUrl(filename);
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const dataUrl = await blobToDataUrl(await response.blob());
    return {
      dataUrl,
      imageUrl,
      sourceUrl: `marketing/instagram-ads/${filename}`,
      query: "NEO Pulse Instagram ad (marketing/instagram-ads in codebase)",
      kind: "other",
      layer: "foreground",
      why: "Checked-in NEO Pulse feed ad from marketing/instagram-ads",
      visualDescription:
        "Designed Instagram feed creative reference: bold type hierarchy, modern layout, minimal on-image text density",
      fitScore: 1,
      qualityScore: 1,
      useFromImage: [
        "Instagram feed ad layout, spacing, and type hierarchy",
        "On-image text density (headline + optional subline only)",
        "Designed sponsored-post composition (not collage)",
      ],
      ignoreFromImage: ["exact headline wording", "logos", "Instagram UI chrome", "exact palette"],
    };
  } catch {
    return null;
  }
}

export async function loadNeoPulseMarketingAdReferenceFromBrief(
  brief: MetaAdCreativeBrief,
): Promise<ImageReferenceResult | null> {
  return loadNeoPulseMarketingAdReference(resolveNeoPulseMarketingAdFilename(brief.referenceAdPattern));
}
