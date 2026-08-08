import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  manualReferencesToProvenance,
  type ManualImageReference,
} from "@/lib/image-generator/manual-reference-upload";
import { runFeaturedImage } from "@/lib/image-generator/run-featured-image";

vi.mock("@/lib/image-reference-research", () => ({
  researchGoogleImageReferences: vi.fn(),
  collectReferenceDataUrls: vi.fn((refs: { dataUrl: string }[]) =>
    refs.map((r) => r.dataUrl),
  ),
  buildGroundedImagePromptSuffix: vi.fn(() => ""),
}));

vi.mock("@/lib/image-api", () => ({
  generateImage: vi.fn().mockResolvedValue({
    imageBase64: "data:image/png;base64,abc",
  }),
}));

vi.mock("@/lib/image-generator/image-content-policy", () => ({
  detectMatureImageRequest: vi.fn().mockResolvedValue(false),
  MATURE_CHECKLIST_OVERRIDE: "",
}));

const baseOptions = {
  userPrompt: "test keyword",
  imageSourceMode: "solo" as const,
  selectedSection: null,
  includeText: false,
  includePeople: false,
  includeAnimals: false,
  includeCars: false,
  isInfographic: false,
  aspectRatio: "1:1" as const,
  style: "professional" as const,
  colorScheme: "vibrant" as const,
  colorForeground: "",
  colorBackground: "",
  imageModel: "google/gemini-3.1-flash-image",
};

const baseContext = {
  apiKey: "sk-test",
  flowTitle: "",
  flowPurpose: "",
  agents: [],
  finalOutput: "",
  selectedModel: "google/gemini-2.5-flash",
  temperature: 1,
  maxTokens: 1000,
  topP: 0.9,
  availableSections: [],
};

describe("manualReferencesToProvenance", () => {
  it("maps manual refs with filename as source", () => {
    const refs: ManualImageReference[] = [
      {
        id: "a",
        fileName: "ref.jpg",
        dataUrl: "data:image/jpeg;base64,xx",
        imageUrl: "",
        query: "manual upload",
        kind: "other",
        layer: "foreground",
        why: "User-provided reference",
        visualDescription: "User-uploaded reference photo",
        fitScore: 1,
        qualityScore: 1,
      },
    ];
    const provenance = manualReferencesToProvenance(refs);
    expect(provenance.mode).toBe("grounded");
    expect(provenance.references[0]?.sourceUrl).toBe("ref.jpg");
    expect(provenance.references[0]?.previewDataUrl).toBe("data:image/jpeg;base64,xx");
  });
});

describe("runFeaturedImage manual references", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips Google Images research when manual references are present", async () => {
    const { researchGoogleImageReferences } = await import("@/lib/image-reference-research");
    const { generateImage } = await import("@/lib/image-api");

    const manualReferences: ManualImageReference[] = [
      {
        id: "1",
        fileName: "upload.png",
        dataUrl: "data:image/png;base64,manual",
        imageUrl: "",
        query: "manual upload",
        kind: "other",
        layer: "foreground",
        why: "User-provided reference",
        visualDescription: "User-uploaded reference photo",
        fitScore: 1,
        qualityScore: 1,
      },
    ];

    const result = await runFeaturedImage(
      { ...baseOptions, manualReferences },
      baseContext,
      [],
    );

    expect(researchGoogleImageReferences).not.toHaveBeenCalled();
    expect(generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceImageDataUrls: ["data:image/png;base64,manual"],
      }),
    );
    expect(result.referenceResearch?.references[0]?.sourceUrl).toBe("upload.png");
  });
});
