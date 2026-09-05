import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  generateChecklistFromSelections,
  generateBlueprintFromTemplate,
} from "@/lib/blog-template-builder";
import { INTERNAL_LINK_PLACEHOLDER_FEATURE_SUFFIX } from "@/lib/content-generation/internal-link-placeholders";

const streamChatCompletion = vi.fn();
const postOpenRouterAppChat = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    streamChatCompletion: (...args: unknown[]) => streamChatCompletion(...args),
  };
});

vi.mock("@/lib/openrouter-app-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/openrouter-app-api")>();
  return {
    ...actual,
    postOpenRouterAppChat: (...args: unknown[]) => postOpenRouterAppChat(...args),
  };
});

vi.mock("@/lib/content-optimization/serp-h2-outline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content-optimization/serp-h2-outline")>();
  return {
    ...actual,
    deriveSerpH2Outline: vi.fn().mockResolvedValue([
      "Motorization Features Compared",
      "Installation And Setup Steps",
      "A Local Homeowner Smart Blinds Story",
      "Cost And Value For Edmonton Homes",
      "Our Recommendation For Smart Blinds",
    ]),
  };
});

const keywordData = {
  keyword: "solar panels edmonton",
  searchVolume: 100,
  difficulty: 40,
  intent: "informational",
};

describe("generateChecklistFromSelections posts optimize", () => {
  beforeEach(() => {
    streamChatCompletion.mockReset();
    postOpenRouterAppChat.mockReset();
    postOpenRouterAppChat.mockResolvedValue({
      content: JSON.stringify({ contentType: "guide" }),
      finishReason: "stop",
      raw: {},
    });
    const checklistText =
      "1. Your Guide to Solar Panels in Edmonton [STRUCTURE]: 2 paragraphs. [LINK]: 3-5 internal links.\n" +
      "2. Benefits of Solar [STRUCTURE]: 2 paragraphs. [LINK]: 3-5 internal links.\n" +
      "3. Installation Process [STRUCTURE]: 2 paragraphs. [LIST]: numbered steps. [LINK]: 3-5 internal links.\n" +
      "4. Cost Factors [STRUCTURE]: 2 paragraphs. [TABLE]: comparison. [LINK]: 3-5 internal links.\n" +
      "5. Find Your Perfect Solar Setup [STRUCTURE]: 1-2 paragraphs. [LINK]: 3-5 internal links.";
    streamChatCompletion.mockImplementation(async ({ onContentChunk, onFinishReason }) => {
      onContentChunk?.(checklistText);
      onFinishReason?.("stop");
      return { finishReason: "stop" };
    });
  });

  it("uses SAP page template when entity is set even if a live URL exists", async () => {
    const sapChecklist =
      "1. The problem here [STRUCTURE]: 2 paragraphs.\n" +
      "2. Local conditions [STRUCTURE]: 2 paragraphs. [LIST]: bullets.\n" +
      "3. What actually fits [STRUCTURE]: 2 paragraphs. [DECISION].\n" +
      "4. A realistic local situation [STRUCTURE]: 2 paragraphs. [ILLUSTRATIVE].\n" +
      "5. What We Offer [STRUCTURE]: 1-2 paragraphs. [TABLE]: catalog.\n" +
      "6. Our Recommendation for Homeowners in Edmonton [STRUCTURE]: 1-2 paragraphs. [RECOMMENDATION]. [TABLE].\n" +
      "7. Next Steps [STRUCTURE]: 1-2 paragraphs. [LIST]: numbered.";
    streamChatCompletion.mockImplementation(async ({ onContentChunk, onFinishReason }) => {
      onContentChunk?.(sapChecklist);
      onFinishReason?.("stop");
      return { finishReason: "stop" };
    });

    await expect(
      generateChecklistFromSelections(
        ["solar panels"],
        ["Benefits", "Installation"],
        "Solar Panels Edmonton",
        keywordData,
        {
          apiKey: "test-key",
          entity: "Edmonton",
          currentPageUrl: "https://example.com/solar-panels/",
          connectedSite: { name: "Test", siteUrl: "https://example.com" },
          primaryKeyword: "solar panels edmonton",
        } as Parameters<typeof generateChecklistFromSelections>[4],
      ),
    ).resolves.toEqual({ items: expect.any(Array), h2Outline: undefined });

    const call = streamChatCompletion.mock.calls[0]?.[0] as {
      messages?: Array<{ role: string; content: string }>;
    };
    const combined = (call?.messages ?? []).map((m) => m.content).join("\n");
    expect(combined).toContain("SAP PAGE TEMPLATE");
    expect(combined).toMatch(/6-7 checklist items/);
    expect(combined).not.toContain("SAP REWRITE SUBSTANCE");
    expect(combined).not.toContain("KEEP EXACT");
    expect(combined).toContain("Product | Best for | Budget | Reason");
    expect(combined).not.toContain("local market knowledge and how we serve businesses");
  });

  it("omits live post HTML from checklist and blueprint prompts", async () => {
    const liveHtml =
      '<h2>Smart Blinds Automation Vs Traditional Blinds</h2>' +
      '<p>Compare <a href="https://blindmagic.com/blog/powerview-guide/">PowerView</a> motorization.</p>';
    const pageInventory = [
      {
        id: 1,
        slug: "hunter-douglas",
        title: "Hunter Douglas",
        excerpt: "",
        link: "https://blindmagic.com/hunter-douglas/",
        date_gmt: "2026-01-01",
        collection: "pages",
        postType: "page" as const,
      },
      {
        id: 2,
        slug: "powerview-guide",
        title: "PowerView Guide",
        excerpt: "",
        link: "https://blindmagic.com/blog/powerview-guide/",
        date_gmt: "2026-01-01",
        collection: "posts",
        postType: "post" as const,
      },
    ];

    await generateChecklistFromSelections(
      ["smart blinds"],
      [],
      "Smart Blinds Automation Vs Traditional Blinds",
      keywordData,
      {
        apiKey: "test-key",
        currentPageUrl: "https://blindmagic.com/blog/smart-blinds-automation/",
        connectedSite: { name: "Blind Magic", siteUrl: "https://blindmagic.com" },
        wordPressPosts: pageInventory,
        primaryKeyword: "smart blinds automation",
        existingContent: liveHtml,
      } as Parameters<typeof generateChecklistFromSelections>[4],
    );

    const checklistCall = streamChatCompletion.mock.calls[0]?.[0] as {
      messages?: Array<{ role: string; content: string }>;
    };
    const checklistPrompt = (checklistCall?.messages ?? []).map((m) => m.content).join("\n");
    expect(checklistPrompt).not.toContain("EXISTING PAGE (FACT SOURCE)");
    expect(checklistPrompt).not.toContain("Compare <a href");
    expect(checklistPrompt).not.toContain("/blog/powerview-guide/");
    expect(checklistPrompt).toContain("INTERNAL LINK TARGETS");
    expect(checklistPrompt).toContain("PAGES");
    expect(checklistPrompt).toContain("Hunter Douglas");

    postOpenRouterAppChat.mockResolvedValueOnce({
      content: JSON.stringify({
        title: "Smart Blinds Guide",
        purpose: "Help homeowners choose automation",
        agents: [
          {
            id: "agent-1",
            step: 1,
            title: "Choosing Smart Blind Systems",
            description: "Compare options",
            features: ["[LINK]: internal links"],
            h2Count: 1,
            h3Count: 0,
            h3Enabled: false,
            headingLevel: 1,
            maxTokens: 1000,
          },
        ],
      }),
      finishReason: "stop",
      raw: {},
    });

    await generateBlueprintFromTemplate(
      ["1. Choosing Smart Blind Systems [STRUCTURE]: 2 paragraphs. [LINK]: links."],
      {
        flowTitle: "Smart Blinds Automation",
        flowPurpose: "Guide",
        keywordData: keywordData as never,
      },
      {
        apiKey: "test-key",
        currentPageUrl: "https://blindmagic.com/blog/smart-blinds-automation/",
        connectedSite: { name: "Blind Magic", siteUrl: "https://blindmagic.com" },
        wordPressPosts: pageInventory,
        existingContent: liveHtml,
      },
    );

    const blueprintCall = postOpenRouterAppChat.mock.calls.find((call) => {
      const msgs = (call[0] as { messages?: Array<{ content: string }> })?.messages ?? [];
      return msgs.some((m) => m.content.includes("checklist") || m.content.includes("blueprint"));
    })?.[0] as { messages?: Array<{ role: string; content: string }> } | undefined;
    const blueprintPrompt = (blueprintCall?.messages ?? []).map((m) => m.content).join("\n");
    expect(blueprintPrompt).not.toContain("EXISTING PAGE (FACT SOURCE)");
    expect(blueprintPrompt).not.toContain("/blog/powerview-guide/");
    expect(blueprintPrompt).toContain("Hunter Douglas");
  });

  it("uses AISO keyword rules instead of ~1% density when first-party authority is present", async () => {
    await generateChecklistFromSelections(
      ["smart blinds"],
      [],
      "Smart Blinds Automation Vs Traditional Blinds",
      keywordData,
      {
        apiKey: "test-key",
        connectedSite: { name: "Blind Magic", siteUrl: "https://blindmagic.com" },
        primaryKeyword: "Smart Blinds Automation Vs Traditional Blinds",
        firstPartyAuthorityBlock: "--- FIRST-PARTY CLAIMS ---\n- We install Hunter Douglas (source: gbp)\n--- END ---",
      } as Parameters<typeof generateChecklistFromSelections>[4],
    );

    const call = streamChatCompletion.mock.calls[0]?.[0] as {
      messages?: Array<{ role: string; content: string }>;
    };
    const combined = (call?.messages ?? []).map((m) => m.content).join("\n");
    expect(combined).toContain("AISO CHECKLIST KEYWORD");
    expect(combined).not.toContain("minimum ~1.0%");
    expect(combined).not.toContain("≥1× per H2");
  });

  it("uses SAP page template for new entity pages without a current URL", async () => {
    const sapChecklist =
      "1. The problem here [STRUCTURE]: 2 paragraphs.\n" +
      "2. Local conditions [STRUCTURE]: 2 paragraphs. [LIST]: bullets.\n" +
      "3. What actually fits [STRUCTURE]: 2 paragraphs. [DECISION].\n" +
      "4. A realistic local situation [STRUCTURE]: 2 paragraphs. [ILLUSTRATIVE].\n" +
      "5. What We Offer [STRUCTURE]: 1-2 paragraphs. [TABLE]: catalog.\n" +
      "6. Our Recommendation for Homeowners in Ben Hill, Atlanta [STRUCTURE]: 1-2 paragraphs. [RECOMMENDATION]. [TABLE].\n" +
      "7. Next Steps [STRUCTURE]: 1-2 paragraphs. [LIST]: numbered.";
    streamChatCompletion.mockImplementation(async ({ onContentChunk, onFinishReason }) => {
      onContentChunk?.(sapChecklist);
      onFinishReason?.("stop");
      return { finishReason: "stop" };
    });

    await generateChecklistFromSelections(
      ["solar panels"],
      ["Benefits", "Installation"],
      "Solar Panels Near Ben Hill",
      keywordData,
      {
        apiKey: "test-key",
        entity: "Ben Hill, Atlanta",
        connectedSite: { name: "Test", siteUrl: "https://example.com" },
        primaryKeyword: "solar panels",
      } as Parameters<typeof generateChecklistFromSelections>[4],
    );

    const call = streamChatCompletion.mock.calls[0]?.[0] as {
      messages?: Array<{ role: string; content: string }>;
    };
    const combined = (call?.messages ?? []).map((m) => m.content).join("\n");
    expect(combined).toContain("SAP PAGE TEMPLATE");
    expect(combined).toContain("Product | Best for | Budget | Reason");
    expect(combined).toContain("What We Offer");
    expect(combined).toContain("Our Recommendation for Homeowners in Ben Hill, Atlanta");
    expect(combined).not.toContain("local market knowledge and how we serve businesses");
    expect(combined).not.toContain("How this topic works");
  });

  it("repairs [LINK] on optimize path via non-stream json_object blueprint", async () => {
    const checklist = [
      "1. Solar Panel Efficiency: What It Means [STRUCTURE]: 2 paragraphs. [LINK]: internal links.",
      "2. Factors That Affect Efficiency [STRUCTURE]: 2 paragraphs. [LINK]: internal links.",
      "3. How to Maximize Output [STRUCTURE]: 2 paragraphs. [LINK]: internal links.",
    ];
    const blueprintJson = JSON.stringify({
      title: "Solar Panel Efficiency Guide",
      purpose: "Explain solar panel efficiency",
      agents: checklist.map((line, i) => ({
        id: `agent-${i + 1}`,
        step: i + 1,
        title: line.split("[")[0]!.replace(/^\d+\.\s*/, "").trim(),
        description: "Section body",
        features: [`[LINK]: ${INTERNAL_LINK_PLACEHOLDER_FEATURE_SUFFIX}`],
        h2Count: 1,
        h3Count: 0,
        h3Enabled: false,
        headingLevel: 1,
        maxTokens: 1000,
      })),
    });
    postOpenRouterAppChat.mockResolvedValue({
      content: blueprintJson,
      finishReason: "stop",
      raw: {},
    });

    const result = await generateBlueprintFromTemplate(
      checklist,
      { flowTitle: "Solar Panel Efficiency", flowPurpose: "Guide", keywordData: keywordData as never },
      {
        apiKey: "test-key",
        currentPageUrl: "https://example.com/solar-efficiency/",
        connectedSite: { name: "Test", siteUrl: "https://example.com" },
      },
    );

    expect(postOpenRouterAppChat).toHaveBeenCalledTimes(1);
    expect(postOpenRouterAppChat.mock.calls[0]?.[0]?.responseFormat).toEqual({ type: "json_object" });
    expect(streamChatCompletion).not.toHaveBeenCalled();
    expect(result.agents.length).toBe(3);
    for (const agent of result.agents) {
      expect(agent.features.some((f) => f.includes(INTERNAL_LINK_PLACEHOLDER_FEATURE_SUFFIX))).toBe(true);
    }
  });

  it("returns blueprint from checklist rows when json_object response is invalid after retries", async () => {
    vi.useFakeTimers();
    postOpenRouterAppChat.mockResolvedValue({
      content: '{"title": "Broken", "purpose": "x", "agents": [{"id": "agent-1"',
      finishReason: "stop",
      raw: {},
    });

    const checklist = ["1. Section A [STRUCTURE]: 2 paragraphs. [LINK]: links."];
    const promise = generateBlueprintFromTemplate(
      checklist,
      { flowTitle: "Test", flowPurpose: "Guide", keywordData: keywordData as never },
      { apiKey: "test-key", currentPageUrl: "https://example.com/page/" },
    );

    await vi.runAllTimersAsync();
    const result = await promise;
    expect(postOpenRouterAppChat).toHaveBeenCalledTimes(3);
    expect(result.agents.length).toBe(1);
    expect(result.agents[0]?.title).toBe("A Local Homeowner Example");
    vi.useRealTimers();
  });
});
