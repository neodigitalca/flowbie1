import { describe, expect, it } from "vitest";
import {
  buildLlmAuditUserPrompt,
  buildChatGptCompanyAuthorityUserPrompt,
  extractLlmAuditPlatformResult,
  llmAuditGuidanceFromBrief,
  llmAuditChecklistItemsFromBrief,
  formatLlmAuditHarnessPromptBlock,
} from "@/lib/llm-audit/llm-audit-dataforseo";
import { cityStateFromNapAddress, resolveSiteLocationLabel, webSearchCountryIsoFromLocation } from "@/lib/llm-audit/resolve-site-location-label";
import type { SeoContentBriefV1 } from "@/lib/overview-seo-content-brief";

describe("buildLlmAuditUserPrompt", () => {
  it("stays within 500 characters and is area-only", () => {
    const prompt = buildLlmAuditUserPrompt({
      platformLabel: "ChatGPT",
      keyword: "Sidelight Window Blinds Near Plum Coulee, MB",
      location: "Plum Coulee, MB",
    });
    expect(prompt.length).toBeLessThanOrEqual(500);
    expect(prompt.toLowerCase()).not.toContain("advanceblinds");
    expect(prompt.toLowerCase()).toContain("this topic");
    expect(prompt.toLowerCase()).toContain("no same-industry businesses");
  });
});

describe("buildChatGptCompanyAuthorityUserPrompt", () => {
  it("asks about this business and stays within 500 characters", () => {
    const prompt = buildChatGptCompanyAuthorityUserPrompt({
      companyName: "Advance Blinds",
      location: "Edmonton, AB",
      topic: "custom blinds",
      siteUrl: "https://advanceblinds.ca/",
    });
    expect(prompt.length).toBeLessThanOrEqual(500);
    expect(prompt).toContain("Advance Blinds");
    expect(prompt).toContain("https://advanceblinds.ca");
    expect(prompt.toLowerCase()).toContain("only this website");
    expect(prompt.toLowerCase()).toContain("same-name");
    expect(prompt.toLowerCase()).toContain("public facts for this topic");
    expect(prompt.toLowerCase()).toContain("do not hunt sales");
    expect(prompt.toLowerCase()).not.toContain("no businesses");
  });

  it("pins Ridgeline Solar to the connected .ca site", () => {
    const prompt = buildChatGptCompanyAuthorityUserPrompt({
      companyName: "Ridgeline Solar",
      location: "Edmonton, AB",
      topic: "Solar Panel Efficiency: What It Means",
      siteUrl: "https://ridgelinesolar.ca/",
    });
    expect(prompt.length).toBeLessThanOrEqual(500);
    expect(prompt).toContain("https://ridgelinesolar.ca");
    expect(prompt.toLowerCase()).toContain("same-name");
  });
});

describe("resolveSiteLocationLabel", () => {
  it("parses Near X from keyword", () => {
    expect(resolveSiteLocationLabel(undefined, "Blinds Near Plum Coulee, MB")).toBe("Plum Coulee, MB");
  });

  it("maps Canada location to CA iso", () => {
    expect(webSearchCountryIsoFromLocation("Plum Coulee, MB")).toBe("CA");
  });

  it("derives city from napInfo.address when locations array is empty", () => {
    expect(
      resolveSiteLocationLabel(
        {
          id: "1",
          name: "Ridgeline Solar",
          siteUrl: "https://ridgelinesolar.ca",
          username: "u",
          appPassword: "p",
          connectedAt: 0,
          napInfo: { address: "123 Main St, Edmonton, AB T5K 1X1" },
        },
        "solar panel efficiency",
      ),
    ).toBe("Edmonton, AB");
  });

  it("derives city from a City, ST NAP address", () => {
    expect(cityStateFromNapAddress("Marietta, GA")).toBe("Marietta, GA");
  });
});

describe("extractLlmAuditPlatformResult", () => {
  it("extracts message text and live links", () => {
    const dfsJson = {
      tasks: [
        {
          status_code: 20000,
          cost: 0.01,
          result: [
            {
              model_name: "o4-mini",
              web_search: true,
              input_tokens: 100,
              output_tokens: 200,
              items: [
                {
                  type: "message",
                  sections: [{ type: "text", text: "Include sidelight sizing. Source: https://example.com/facts" }],
                  annotations: [{ title: "Example", url: "https://example.com/facts" }],
                },
              ],
            },
          ],
        },
      ],
    };
    const out = extractLlmAuditPlatformResult("chat_gpt", "ChatGPT", "o4-mini", dfsJson);
    expect(out.status).toBe("ok");
    expect(out.webSearchUsed).toBe(true);
    expect(out.liveLinks).toContain("https://example.com/facts");
    expect(out.responseText).toContain("sidelight sizing");
  });
});

describe("llmAuditGuidanceFromBrief", () => {
  it("returns guidance without liveLinks", () => {
    const brief = {
      llmAudit: {
        siteUrl: "https://example.com",
        location: "Plum Coulee, MB",
        platforms: [
          {
            platform: "chat_gpt" as const,
            label: "ChatGPT",
            model_name: "o4-mini",
            status: "ok" as const,
            responseText: "Cover sidelight sizing and install tips.",
            liveLinks: ["https://should-not-appear.com"],
          },
        ],
      },
    } as SeoContentBriefV1;
    const guidance = llmAuditGuidanceFromBrief(brief);
    expect(guidance).toContain("sidelight sizing");
    expect(guidance).not.toContain("should-not-appear.com");
  });
});

describe("llmAuditChecklistItemsFromBrief", () => {
  it("splits dash-separated platform bullets into checklist facts", () => {
    const brief = {
      llmAudit: {
        siteUrl: "https://example.com",
        location: "Plum Coulee, MB",
        platforms: [
          {
            platform: "chat_gpt" as const,
            label: "ChatGPT",
            model_name: "o4-mini",
            status: "ok" as const,
            responseText:
              '- Locals call Main Avenue "The Avenue" when giving directions.- Sunset Beach is known as "the Cove" by teens.',
            liveLinks: [],
          },
        ],
      },
    } as SeoContentBriefV1;
    const items = llmAuditChecklistItemsFromBrief(brief);
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.some((l) => /The Avenue/i.test(l))).toBe(true);
    expect(items.some((l) => /the Cove/i.test(l))).toBe(true);
  });
});

describe("formatLlmAuditHarnessPromptBlock", () => {
  it("scopes audit facts to section assignments and anti-repetition", () => {
    const block = formatLlmAuditHarnessPromptBlock("## ChatGPT\nLocals say Alty for Altona.");
    expect(block).toContain("section-scoped");
    expect(block).toContain("Alty");
    expect(block).toContain("exactly ONE section");
    expect(block).toContain("decision, tradeoff, or process");
    expect(block).toContain("Do not add H2s");
  });
});
