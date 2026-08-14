import { describe, expect, it, vi, beforeEach } from "vitest";
import { runMetaAdImageChecklistAgent } from "@/lib/ppc/meta-ad-agents";
import { callMetaAdJsonCompletion } from "@/lib/ppc/meta-ad-openrouter-json";
import type {
  MetaAdBlueprint,
  MetaAdCopy,
  MetaAdCreativeBrief,
  MetaAdInstagramGoal,
} from "@/lib/ppc/meta-ads-types";
import { TYPOGRAPHY_PALETTE, withToolPalette } from "@/lib/ppc/__tests__/meta-ad-test-fixtures";

vi.mock("@/lib/ppc/meta-ad-openrouter-json", () => ({
  callMetaAdJsonCompletion: vi.fn(),
}));

vi.mock("@/lib/master-instructions-storage", () => ({
  ensureMasterInstructionsInMemory: vi.fn().mockResolvedValue(undefined),
  appendMasterInstructionsToSystemPrompt: (prompt: string) => prompt,
}));

const sampleGoal: MetaAdInstagramGoal = {
  goalStatement: "Drive local SEO leads.",
  primaryTopic: "Edmonton SEO services",
  audience: "Local business owners",
  adAngle: "We help you rank",
  hook: "Ready to grow?",
  visualDirection: "Bold typographic feed graphic",
  creativeMode: "agency_service",
  referenceQueries: [],
};

const sampleBrief: MetaAdCreativeBrief = withToolPalette(
  {
    strategyStatement: "Local SEO awareness ad.",
    captionHook: "Search drives calls.",
    onImageHeadline: "Get Found Locally",
    onImageSubline: "",
    visualConcept: "Bold minimal feed graphic with lime accent bars",
    visualVibe: "bold-minimal",
    backgroundTreatment: "Dark gradient",
    useMapOverlay: false,
    creativeStyle: "designed_graphic",
  },
  TYPOGRAPHY_PALETTE,
);

const sampleBlueprint: MetaAdBlueprint = {
  angle: "Local SEO",
  audience: "Owners",
  hook: "Grow",
  visualDirection: "Designed graphic",
};

const sampleCopy: MetaAdCopy = {
  primaryText: "We help Edmonton businesses get found.",
  headline: "Edmonton SEO",
  description: "Free audit",
  cta: "Get Quote",
  finalUrl: "https://example.com/edmonton-seo",
};

describe("runMetaAdImageChecklistAgent", () => {
  beforeEach(() => {
    vi.mocked(callMetaAdJsonCompletion).mockReset();
  });

  it("calls OpenRouter and returns parsed checklist items", async () => {
    vi.mocked(callMetaAdJsonCompletion).mockResolvedValueOnce({
      items: [{ id: "1", label: "Render exact on-image headline once", detail: "Get Found Locally" }],
    });

    const items = await runMetaAdImageChecklistAgent({
      apiKey: "test-key",
      model: "test-model",
      goal: sampleGoal,
      blueprint: sampleBlueprint,
      creativeBrief: sampleBrief,
      copy: sampleCopy,
      placement: "feed_1x1",
      siteName: "Acme Windows",
      visualReferenceElements: [
        {
          id: "1",
          label: "Layout ref",
          kind: "layout",
          googleImageQuery: "instagram feed sponsored ad graphic design",
          acceptanceBrief: "Designed feed ad layout",
        },
      ],
    });

    expect(callMetaAdJsonCompletion).toHaveBeenCalledTimes(1);
    expect(items).toHaveLength(1);
    expect(items[0]?.label).toContain("headline");
  });

  it("throws when OpenRouter returns no checklist items", async () => {
    vi.mocked(callMetaAdJsonCompletion).mockResolvedValueOnce({ items: [] });

    await expect(
      runMetaAdImageChecklistAgent({
        apiKey: "test-key",
        model: "test-model",
        goal: sampleGoal,
        blueprint: sampleBlueprint,
        creativeBrief: sampleBrief,
        copy: sampleCopy,
        placement: "feed_1x1",
        siteName: "Acme Windows",
        visualReferenceElements: [],
      }),
    ).rejects.toThrow("Image checklist returned no items.");
  });
});
