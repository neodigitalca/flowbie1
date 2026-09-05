import manifestJson from "../../../docs/api/_manifest.json";
import type { ApiDocManifest } from "./types";

export const apiDocsManifest = manifestJson as ApiDocManifest;

export function getAllManifestSlugs(): string[] {
  return apiDocsManifest.sections.flatMap((section) => section.items.map((item) => item.slug));
}
