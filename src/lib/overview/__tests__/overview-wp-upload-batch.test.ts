import { describe, expect, it, vi, beforeEach } from "vitest";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { OverviewBinding } from "@/hooks/overview/use-overview-wordpress-binding";
import type { WordPressSite } from "@/components/integrations/types";
import {
  buildWpUploadEligibleRows,
  runOverviewWpUploadBatch,
} from "@/lib/overview/overview-wp-upload-batch";
import { overviewBulkScopeUrlKeysFromRows } from "@/lib/overview/overview-bulk-row-scope";

const updateOverviewSeoItem = vi.fn();
const updateWordPressPost = vi.fn();

vi.mock("@/lib/wordpress-api/meta", () => ({
  updateOverviewSeoItem: (...args: unknown[]) => updateOverviewSeoItem(...args),
}));

vi.mock("@/lib/wordpress-api/crud", () => ({
  updateWordPressPost: (...args: unknown[]) => updateWordPressPost(...args),
}));

function testSite(): WordPressSite {
  return {
    id: "site-1",
    name: "Test",
    siteUrl: "https://example.com",
    username: "user",
    appPassword: "pass",
    connectedAt: Date.now(),
  } as WordPressSite;
}

describe("runOverviewWpUploadBatch", () => {
  beforeEach(() => {
    updateOverviewSeoItem.mockReset();
    updateWordPressPost.mockReset();
  });

  it("uploads each meta row via updateOverviewSeoItem (no batch/v1)", async () => {
    const rowCount = 30;
    const rows: OverviewRow[] = [];
    const bindings: Record<string, OverviewBinding> = {};

    for (let i = 0; i < rowCount; i += 1) {
      const url = `https://example.com/post-${i}/`;
      rows.push({
        url,
        title: `Title ${i}`,
        metaDescription: `Meta ${i}`,
        aiTitle: "",
        aiMeta: "",
        status: "idle",
        focusKeyword: `kw ${i}`,
      });
      bindings[url] = { postId: 1000 + i, subtype: "post" };
    }

    const eligible = buildWpUploadEligibleRows(rows, bindings, overviewBulkScopeUrlKeysFromRows(rows));
    expect(eligible).toHaveLength(rowCount);

    let inFlight = 0;
    let maxInFlight = 0;
    updateOverviewSeoItem.mockImplementation(async (_site, _user, _pass, item) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return {
        postId: (item as { postId: number }).postId,
        ok: true,
        method: "direct_put",
      };
    });

    const setBulkOptimizationState = vi.fn((updater: (prev: Record<string, unknown>) => unknown) => {
      if (typeof updater === "function") {
        updater({});
      }
    });
    const setOptimizationProgress = vi.fn((updater: (prev: Record<string, unknown>) => unknown) => {
      if (typeof updater === "function") {
        updater({});
      }
    });

    const site = testSite();
    const batchKey = `${site.id}-batch`;
    const stats = await runOverviewWpUploadBatch({
      site,
      eligible,
      batchKey,
      harnessSetters: {
        siteId: site.id,
        batchKey,
        setBulkOptimizationState,
        setOptimizationProgress,
      },
    });

    expect(updateWordPressPost).not.toHaveBeenCalled();
    expect(updateOverviewSeoItem).toHaveBeenCalledTimes(rowCount);
    expect(maxInFlight).toBe(25);
    expect(stats.stats.okCount).toBe(rowCount);
    expect(stats.stats.failCount).toBe(0);
  });

  it("uploads body rows via updateWordPressPost then ACF item write", async () => {
    const url = "https://example.com/post-with-overview/";
    const rows: OverviewRow[] = [
      {
        url,
        title: "Title",
        metaDescription: "Meta",
        aiTitle: "",
        aiMeta: "",
        status: "idle",
        focusKeyword: "kw",
        postContentOptimized: "<h2>Overview</h2><p>Body</p>",
      },
    ];
    const bindings: Record<string, OverviewBinding> = {
      [url]: { postId: 42, subtype: "post" },
    };
    const eligible = buildWpUploadEligibleRows(rows, bindings, overviewBulkScopeUrlKeysFromRows(rows));
    expect(eligible).toHaveLength(1);
    expect(eligible[0]?.bundle.item.postContent?.length).toBeGreaterThan(0);

    updateWordPressPost.mockResolvedValue({ success: true, postId: 42 });
    updateOverviewSeoItem.mockResolvedValue({ postId: 42, ok: true, method: "acf_post" });

    const site = testSite();
    const batchKey = `${site.id}-batch`;
    const stats = await runOverviewWpUploadBatch({
      site,
      eligible,
      batchKey,
      harnessSetters: {
        siteId: site.id,
        batchKey,
        setBulkOptimizationState: vi.fn(),
        setOptimizationProgress: vi.fn(),
      },
    });

    expect(updateWordPressPost).toHaveBeenCalledTimes(1);
    expect(stats.stats.okCount).toBe(1);
    expect(stats.stats.failCount).toBe(0);
  });

  it("uses resolveBinding when bindings map is empty but inventory match exists", () => {
    const url = "https://example.com/service-area/phoenix/";
    const rows: OverviewRow[] = [
      {
        url,
        title: "Phoenix window treatments",
        metaDescription: "",
        aiTitle: "",
        aiMeta: "",
        status: "idle",
        focusKeyword: "phoenix window treatments",
      },
    ];
    const eligible = buildWpUploadEligibleRows(rows, {}, overviewBulkScopeUrlKeysFromRows(rows), null, {
      resolveBinding: () => ({ postId: 77, subtype: "service-area" }),
    });
    expect(eligible).toHaveLength(1);
    expect(eligible[0]?.bundle.item.postTypeEndpoint).toBe("service-area");
  });
});
