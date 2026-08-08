import type { ImageReferenceProvenance } from "@/components/generator/image/image-generator-types";
import type { ImageReferenceResult } from "@/lib/image-reference-research";
import { prepareLocalImageDataUrl } from "@/lib/overview/overview-blog-local-image-generate";

export type ManualImageReference = ImageReferenceResult & {
  /** Stable key for UI list (filename + upload time). */
  id: string;
  fileName: string;
};

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string" && result.startsWith("data:image/")) {
        resolve(result);
        return;
      }
      reject(new Error(`Could not read image: ${file.name}`));
    };
    reader.onerror = () => reject(new Error(`Could not read image: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export async function prepareManualReference(file: File): Promise<ManualImageReference> {
  const rawDataUrl = await readFileAsDataUrl(file);
  const prepared = await prepareLocalImageDataUrl(rawDataUrl);
  const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  return {
    id,
    fileName: file.name,
    dataUrl: prepared.dataUrl,
    imageUrl: "",
    query: "manual upload",
    kind: "other",
    layer: "foreground",
    why: "User-provided reference",
    visualDescription: "User-uploaded reference photo",
    fitScore: 1,
    qualityScore: 1,
    useFromImage: ["Match subject identity, materials, and setting cues from this photo."],
    ignoreFromImage: ["Watermarks, UI chrome, and photo borders."],
  };
}

export function manualReferencesToProvenance(
  refs: ManualImageReference[],
): ImageReferenceProvenance {
  return {
    mode: refs.length ? "grounded" : "abstract",
    queries: refs.length ? ["manual upload"] : [],
    references: refs.map((r) => ({
      imageUrl: r.imageUrl,
      sourceUrl: r.fileName,
      query: r.query,
      kind: r.kind,
      layer: r.layer,
      why: r.why,
      previewDataUrl: r.dataUrl,
      useFromImage: r.useFromImage,
      ignoreFromImage: r.ignoreFromImage,
    })),
  };
}

export function stripManualReferenceIds(refs: ManualImageReference[]): ImageReferenceResult[] {
  return refs.map(({ id: _id, fileName: _fileName, ...rest }) => rest);
}
