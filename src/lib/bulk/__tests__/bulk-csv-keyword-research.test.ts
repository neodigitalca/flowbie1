import { describe, expect, it, vi } from "vitest";
import type { BulkProcessingOptions } from "@/lib/bulk-auto-generate";
import { generateRowOutputs } from "@/lib/bulk-auto-generate";
import { BulkFileManager } from "@/lib/bulk-file-manager";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";

describe("bulk CSV keyword research", () => {
  const row: CSVRow = {
    keyword: "Hunter Douglas warranty",
    title: "Hunter Douglas Warranty Policy Explained",
  };

  const options = {
    apiKey: "test",
    openRouterApiKey: "test",
    onProgress: vi.fn(),
  } as BulkProcessingOptions;

  it("uses CSV keyword when DataForSEO returns nothing", async () => {
    const fileManager = new BulkFileManager();
    const analyzeKeywordFn = vi.fn().mockResolvedValue(null);

    const { research } = await generateRowOutputs(
      0,
      row,
      options,
      fileManager,
      analyzeKeywordFn,
    );

    expect(research?.result.primaryKeyword).toBe("Hunter Douglas warranty");
    expect(research?.result.keywordData.keyword).toBe("Hunter Douglas warranty");
    expect(research?.aiAnalysis).toBeTruthy();
  });

  it("keeps CSV keyword when DataForSEO returns a different primary", async () => {
    const fileManager = new BulkFileManager();
    const analyzeKeywordFn = vi.fn().mockResolvedValue({
      result: {
        primaryKeyword: "different keyword",
        keywordData: {
          keyword: "different keyword",
          difficulty: 10,
          searchVolume: 100,
          cpc: 1,
          competition: "LOW",
          intent: "informational",
          relatedKeywords: [],
          serpFeatures: [],
        },
        semanticKeywords: [],
        searchIntent: "informational",
      },
      aiAnalysis: {
        keywordSuggestions: { primary: "different keyword", variations: [], longTail: [], semantic: [] },
        h2Suggestions: [],
        contentGaps: [],
        peopleAlsoAsk: [],
        researchLinks: [],
      },
      keywordsVolumeData: [],
    });

    const { research } = await generateRowOutputs(
      0,
      row,
      options,
      fileManager,
      analyzeKeywordFn,
    );

    expect(research?.result.primaryKeyword).toBe("Hunter Douglas warranty");
    expect(research?.result.keywordData.keyword).toBe("Hunter Douglas warranty");
  });

  it("falls back to CSV stub when DataForSEO throws", async () => {
    const fileManager = new BulkFileManager();
    const analyzeKeywordFn = vi.fn().mockRejectedValue(
      new Error("Could not extract keyword data from DataForSEO response"),
    );

    const { research } = await generateRowOutputs(
      0,
      row,
      options,
      fileManager,
      analyzeKeywordFn,
    );

    expect(research?.result.primaryKeyword).toBe("Hunter Douglas warranty");
  });
});
