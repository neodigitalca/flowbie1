import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  optimizeRowToCsvRow,
  runOptimizeViaBulkGenerate,
} from "@/lib/content-optimization/optimize-via-bulk-generate";
import { generateBlueprintAndContent } from "@/lib/bulk-auto-generate";
import { OptimizationFileManager } from "@/lib/optimization-file-manager";

vi.mock("@/lib/bulk-auto-generate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bulk-auto-generate")>();
  return {
    ...actual,
    generateBlueprintAndContent: vi.fn(async () => []),
  };
});

vi.mock("@/lib/implementation-report-generator", () => ({
  generateImplementationReport: vi.fn(async () => undefined),
}));

const baseSite = {
  id: "site-1",
  name: "Test Site",
  siteUrl: "https://example.com",
  username: "user",
  appPassword: "pass",
};

describe("optimizeRowToCsvRow", () => {
  it("builds CSVRow with entity and seo_research, no existing HTML", () => {
    const row = optimizeRowToCsvRow({
      url: "https://example.com/sunset-park/",
      title: "Sunset Park Window Treatments",
      primaryKeyword: "window treatments sunset park",
      seoResearchRaw: '{"focusKeyword":"window treatments sunset park"}',
      entity: "Sunset Park, AB",
      origin: "Sunset Park, AB",
    });
    expect(row.destination_url).toBe("https://example.com/sunset-park/");
    expect(row.seo_research).toContain("window treatments");
    expect(row.entity).toBe("Sunset Park, AB");
    expect(row.origin).toBe("Sunset Park, AB");
    expect(row).not.toHaveProperty("existingContent");
    expect(row).not.toHaveProperty("content");
  });
});

describe("runOptimizeViaBulkGenerate", () => {
  beforeEach(() => {
    vi.mocked(generateBlueprintAndContent).mockClear();
  });

  it("calls generateBlueprintAndContent with updateTargetPostId and no existing HTML on row", async () => {
    const fileManager = new OptimizationFileManager();
    const setOptimizationProgress = vi.fn();

    await runOptimizeViaBulkGenerate({
      siteId: "site-1",
      site: baseSite as never,
      url: "https://example.com/sunset-park/",
      updateMode: "update",
      primaryKeyword: "window treatments",
      title: "Sunset Park",
      seoResearchRaw: '{"focusKeyword":"window treatments"}',
      entity: "Sunset Park, AB",
      selectedKeyword: { query: "window treatments", clicks: 1, impressions: 10, ctr: 0.1, position: 5 },
      gscResult: null,
      existingPost: { id: 42, slug: "sunset-park" },
      existingTitle: "Live title",
      existingContent: "<p>Old body</p>",
      existingExcerpt: "",
      wordPressPosts: [],
      openRouterApiKey: "test-key",
      isSapRun: true,
      optimizationOptions: {},
      fileManager,
      setOptimizationProgress,
    });

    expect(generateBlueprintAndContent).toHaveBeenCalledTimes(1);
    const call = vi.mocked(generateBlueprintAndContent).mock.calls[0]!;
    const csvRow = call[1];
    const options = call[6];
    expect(csvRow.seo_research).toContain("window treatments");
    expect(csvRow.entity).toBe("Sunset Park, AB");
    expect(csvRow).not.toHaveProperty("content");
    expect(options.updateTargetPostId).toBe(42);
    expect(options.optimizePreserveTitle).toBe("Live title");
    expect(options.optimizePreserveSlug).toBe("sunset-park");
    expect(options.forceFreshTopicFanout).toBe(true);
    expect(options.openRouterOnly).toBeUndefined();
    expect(options.useEntitySitemapTemplate).toBe(true);
    expect(options.sequentialHarnessSections).toBe(true);
  });

  it("throws when post ID is missing", async () => {
    await expect(
      runOptimizeViaBulkGenerate({
        siteId: "site-1",
        site: baseSite as never,
        url: "https://example.com/",
        updateMode: "update",
        primaryKeyword: "kw",
        title: "Title",
        seoResearchRaw: '{"focusKeyword":"kw"}',
        selectedKeyword: { query: "kw", clicks: 0, impressions: 0, ctr: 0, position: 0 },
        gscResult: null,
        existingPost: {},
        existingTitle: "Title",
        existingContent: "",
        existingExcerpt: "",
        wordPressPosts: [],
        openRouterApiKey: "test-key",
        isSapRun: false,
        optimizationOptions: {},
        fileManager: new OptimizationFileManager(),
        setOptimizationProgress: vi.fn(),
      }),
    ).rejects.toThrow(/post ID/i);
  });
});
