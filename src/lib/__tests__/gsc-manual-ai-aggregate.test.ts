import { describe, expect, it, vi } from "vitest";
import {
  GSC_MANUAL_MAX_INPUT_CHARS,
  GSC_MANUAL_MAX_TOP_ROWS,
  bundleGscManualFilesForPrompt,
  extractJsonObjectFromModelText,
  parseAndValidateGscManualAiJson,
  gscManualAiPayloadToMarkdown,
  runGscManualAiAggregate,
} from "@/lib/gsc-manual-ai-aggregate";

vi.mock("@/lib/competitor-research/competitor-report-openrouter", () => ({
  callOpenRouterChatCompletion: vi.fn(),
}));

import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";

const validPayloadJson = JSON.stringify({
  executiveSummary: "Traffic is stable. Focus on high-impression low-CTR queries.",
  topOpportunities: [
    {
      rank: 1,
      label: "example query",
      why: "High impressions",
      metrics: "Mar impr 61, Feb impr 0, Mar pos 78.77",
      evidence: ['alberta modular homes,0,0,61,0,0%,0%,78.77,0'],
    },
  ],
  clusters: [
    { name: "Modular homes", examples: ["prefab alberta", "calgary modular"], aggregate: "Regional intent." },
  ],
});

describe("gsc-manual-ai-aggregate", () => {
  it("bundleGscManualFilesForPrompt truncates when over cap", () => {
    const huge = "x".repeat(GSC_MANUAL_MAX_INPUT_CHARS + 5000);
    const { text, truncated } = bundleGscManualFilesForPrompt([{ name: "a.csv", content: huge }]);
    expect(truncated).toBe(true);
    expect(text.length).toBeLessThanOrEqual(GSC_MANUAL_MAX_INPUT_CHARS + 400);
    expect(text).toMatch(/truncated|TRUNCATION/i);
  });

  it("extractJsonObjectFromModelText handles markdown fences", () => {
    const wrapped = `\nHere is JSON:\n\`\`\`json\n${validPayloadJson}\n\`\`\`\n`;
    expect(JSON.parse(extractJsonObjectFromModelText(wrapped))).toMatchObject({
      executiveSummary: expect.any(String),
    });
  });

  it("parseAndValidateGscManualAiJson accepts valid payload", () => {
    const p = parseAndValidateGscManualAiJson(validPayloadJson);
    expect(p.topOpportunities).toHaveLength(1);
    expect(p.clusters).toHaveLength(1);
  });

  it("parseAndValidateGscManualAiJson rejects too many top rows", () => {
    const bad = JSON.stringify({
      executiveSummary: "x",
      topOpportunities: Array.from({ length: GSC_MANUAL_MAX_TOP_ROWS + 5 }, (_, i) => ({
        rank: i + 1,
        label: "q",
        why: "w",
        metrics: "m",
        evidence: ["a,1,2"],
      })),
      clusters: [],
    });
    expect(() => parseAndValidateGscManualAiJson(bad)).toThrow(
      new RegExp(`more than ${GSC_MANUAL_MAX_TOP_ROWS}`),
    );
  });

  it("parseAndValidateGscManualAiJson requires evidence lines", () => {
    const bad = JSON.stringify({
      executiveSummary: "x",
      topOpportunities: [{ rank: 1, label: "a", why: "b", metrics: "c" }],
      clusters: [],
    });
    expect(() => parseAndValidateGscManualAiJson(bad)).toThrow(/evidence/);
  });

  it("bundleGscManualFilesForPrompt keeps every file when over cap", () => {
    const big = "q\n" + "x".repeat(GSC_MANUAL_MAX_INPUT_CHARS);
    const small = "page,clicks\nhttps://example.com/,10\n";
    const { text, truncated } = bundleGscManualFilesForPrompt([
      { name: "Queries.csv", content: big },
      { name: "Pages.csv", content: small },
    ]);
    expect(truncated).toBe(true);
    expect(text).toContain("Queries.csv");
    expect(text).toContain("Pages.csv");
    expect(text).toContain("https://example.com/");
  });

  it("gscManualAiPayloadToMarkdown includes property and table", () => {
    const md = gscManualAiPayloadToMarkdown({
      siteName: "Test Site",
      siteUrl: "https://example.com",
      filenames: ["Queries.csv"],
      truncatedInput: false,
      payload: parseAndValidateGscManualAiJson(validPayloadJson),
    });
    expect(md).toContain("Test Site");
    expect(md).toContain("https://example.com");
    expect(md).toContain("Queries.csv");
    expect(md).toContain("### 1.");
    expect(md).toContain("Evidence (verbatim");
  });

  it("runGscManualAiAggregate writes validated markdown from mocked OpenRouter", async () => {
    vi.mocked(callOpenRouterChatCompletion).mockResolvedValueOnce({
      raw: {},
      content: validPayloadJson,
    });

    const md = await runGscManualAiAggregate({
      apiKey: "k",
      model: "google/gemini-2.5-flash-lite",
      siteName: "S",
      siteUrl: "https://s.example",
      files: [{ name: "f.csv", content: "a,b\n1,2\n" }],
    });

    expect(md).toContain("# GSC manual import");
    expect(md).toContain("Modular homes");
    expect(callOpenRouterChatCompletion).toHaveBeenCalledTimes(1);
  });

  it("runGscManualAiAggregate throws when API returns invalid JSON", async () => {
    vi.mocked(callOpenRouterChatCompletion).mockResolvedValueOnce({
      raw: {},
      content: "not json",
    });

    await expect(
      runGscManualAiAggregate({
        apiKey: "k",
        model: "google/gemini-2.5-flash-lite",
        siteName: "S",
        siteUrl: "https://s.example",
        files: [{ name: "f.csv", content: "x" }],
      }),
    ).rejects.toThrow();
  });
});
