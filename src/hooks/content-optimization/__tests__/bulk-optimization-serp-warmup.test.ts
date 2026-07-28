import { describe, expect, it, vi, beforeEach } from "vitest";
import { createBulkSerpWarmupController } from "../bulk-optimization-serp-warmup";
import { hasSubstantiveSeoResearch } from "../bulk-optimization-missing-seo-research";

const fetchBrief = vi.fn();
const writeKw = vi.fn();

vi.mock("../bulk-optimization-missing-seo-research", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bulk-optimization-missing-seo-research")>();
  return {
    ...actual,
    fetchDataForSeoSerpBriefJson: (...args: unknown[]) => fetchBrief(...args),
  };
});

vi.mock("../write-missing-focus-keyword-ai", () => ({
  writeMissingFocusKeywordWithAi: (...args: unknown[]) => writeKw(...args),
}));

describe("createBulkSerpWarmupController", () => {
  beforeEach(() => {
    fetchBrief.mockReset();
    writeKw.mockReset();
    fetchBrief.mockResolvedValue('{"version":1,"focusKeyword":"kw b"}');
    writeKw.mockResolvedValue("hunter douglas blinds edmonton");
  });

  it("fills missing seo_research via DataForSEO when keyword exists", async () => {
    const urls = ["https://example.com/a/", "https://example.com/b/", "https://example.com/c/"];
    const acf = new Map<number, Record<string, unknown>>([
      [0, { keyword_focus: "kw a", seo_research: '{"brief":true}' }],
      [1, { keyword_focus: "kw b" }],
      [2, { keyword_focus: "kw c", seo_research: '{"brief":true}' }],
    ]);
    const pending = new Map<number, { pending: Record<string, unknown>; primaryKeyword: string }>();
    const skipUrlSet = new Set<string>();
    let batchState: Record<string, unknown> = {};

    const controller = createBulkSerpWarmupController({
      urls,
      batchKey: "site-batch",
      skipUrlSet,
      muteToasts: true,
      prefetchedAcfFieldsCache: acf,
      prefetchedPendingCache: pending,
      setBulkOptimizationState: (updater) => {
        batchState = updater({ "site-batch": batchState })["site-batch"] as Record<string, unknown>;
        return { "site-batch": batchState };
      },
    });

    controller.seedReadyFromAcf();
    expect(controller.isIndexReady(0)).toBe(true);
    expect(controller.isIndexReady(1)).toBe(false);
    expect(controller.isIndexReady(2)).toBe(true);

    const ready1 = await controller.ensureReady(1);
    expect(ready1).toBe(true);
    expect(writeKw).not.toHaveBeenCalled();
    expect(fetchBrief).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: "kw b", pageUrl: "https://example.com/b/" }),
    );
    expect(hasSubstantiveSeoResearch(acf.get(1))).toBe(true);
  });

  it("writes keyword_focus via OpenRouter AI when missing, then fills research", async () => {
    const urls = ["https://example.com/service-area/hunter-douglas-blinds-edmonton/"];
    const acf = new Map<number, Record<string, unknown>>([[0, {}]]);
    const pending = new Map<number, { pending: Record<string, unknown>; primaryKeyword: string }>([
      [
        0,
        {
          pending: {
            site: { id: "site-1" },
            existingTitle: "Hunter Douglas Blinds Edmonton",
            acfFields: {},
          },
          primaryKeyword: "",
        },
      ],
    ]);
    const skipUrlSet = new Set<string>();

    const controller = createBulkSerpWarmupController({
      urls,
      batchKey: "site-batch",
      skipUrlSet,
      muteToasts: true,
      prefetchedAcfFieldsCache: acf,
      prefetchedPendingCache: pending,
      setBulkOptimizationState: (updater) => updater({ "site-batch": {} }),
    });

    const ok = await controller.ensureReady(0);
    expect(ok).toBe(true);
    expect(writeKw).toHaveBeenCalledWith(
      expect.objectContaining({
        url: urls[0],
        title: "Hunter Douglas Blinds Edmonton",
        siteId: "site-1",
      }),
    );
    expect(String(acf.get(0)?.keyword_focus ?? "")).toBe("hunter douglas blinds edmonton");
    expect(fetchBrief).toHaveBeenCalled();
    expect(hasSubstantiveSeoResearch(acf.get(0))).toBe(true);
  });

  it("skips DataForSEO when cache already has substantive seo_research", async () => {
    const urls = ["https://example.com/already-researched/"];
    const acf = new Map<number, Record<string, unknown>>([
      [0, { keyword_focus: "kw", seo_research: '{"primary_keyword":"kw"}' }],
    ]);
    const pending = new Map<number, { pending: Record<string, unknown>; primaryKeyword: string }>();
    const skipUrlSet = new Set<string>();

    const controller = createBulkSerpWarmupController({
      urls,
      batchKey: "site-batch",
      skipUrlSet,
      muteToasts: true,
      prefetchedAcfFieldsCache: acf,
      prefetchedPendingCache: pending,
      setBulkOptimizationState: (updater) => updater({ "site-batch": {} }),
    });

    controller.seedReadyFromAcf();
    const ok = await controller.ensureReady(0);
    expect(ok).toBe(true);
    expect(fetchBrief).not.toHaveBeenCalled();
    expect(writeKw).not.toHaveBeenCalled();
  });
});
