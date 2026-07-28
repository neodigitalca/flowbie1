import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import type { GbpSchedulerSectionState } from "@/lib/gbp-post/gbp-schedule-plan";
import { runGbpMultiSiteBatch } from "@/lib/gbp-post/gbp-post-multi-site-batch";
import { runGbpSitePostBatch } from "@/lib/gbp-post/gbp-post-one-site";

vi.mock("@/lib/gbp-post/gbp-post-one-site", () => ({
  runGbpSitePostBatch: vi.fn(),
}));

vi.mock("@/lib/app-notifications", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

const testScheduler: GbpSchedulerSectionState = {
  numberOfPosts: 1,
  scheduleFrequency: "daily",
  customInterval: 1,
  dayOfWeek: 1,
  startDateOption: "immediate",
  customStartDate: new Date("2026-01-01"),
  startTime: "09:00",
  rowOrder: [0],
};

function baseSite(id: string, name: string): WordPressSite {
  return {
    id,
    name,
    siteUrl: `https://${id}.example`,
    username: "u",
    appPassword: "p",
    connectedAt: 0,
    gbpLocationId: `gbp-${id}`,
  };
}

describe("runGbpMultiSiteBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs all sites in parallel", async () => {
    const sites = [baseSite("a", "Alpha"), baseSite("b", "Beta"), baseSite("c", "Gamma")];
    const startOrder: string[] = [];
    const resolveFns: Array<() => void> = [];

    vi.mocked(runGbpSitePostBatch).mockImplementation(async ({ site }) => {
      startOrder.push(site.id);
      await new Promise<void>((resolve) => {
        resolveFns.push(resolve);
      });
      return {
        published: 1,
        queued: 0,
        failed: 0,
        lastPreview: null,
        resolvedTopic: "topic",
        inventoryHosted: null,
      };
    });

    const batchPromise = runGbpMultiSiteBatch({
      sites,
      scheduler: testScheduler,
      openRouterApiKey: "test-key",
      sitemapSource: "pages",
    });

    await vi.waitFor(() => expect(startOrder).toHaveLength(3));
    expect(startOrder).toEqual(["a", "b", "c"]);

    for (const resolve of resolveFns) resolve();
    const result = await batchPromise;

    expect(result.propertiesAttempted).toBe(3);
    expect(result.published).toBe(3);
    expect(result.failed).toBe(0);
    expect(runGbpSitePostBatch).toHaveBeenCalledTimes(3);
  });

  it("calls onPropertyStart for each site before work completes", async () => {
    const sites = [baseSite("a", "Alpha"), baseSite("b", "Beta")];
    const propertyStarts: string[] = [];
    let releaseBatch!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseBatch = resolve;
    });

    vi.mocked(runGbpSitePostBatch).mockImplementation(async () => {
      await gate;
      return {
        published: 1,
        queued: 0,
        failed: 0,
        lastPreview: null,
        resolvedTopic: "",
        inventoryHosted: null,
      };
    });

    const batchPromise = runGbpMultiSiteBatch({
      sites,
      scheduler: testScheduler,
      openRouterApiKey: "test-key",
      sitemapSource: "pages",
      onPropertyStart: (site) => {
        propertyStarts.push(site.id);
      },
    });

    await vi.waitFor(() => expect(propertyStarts).toEqual(["a", "b"]));
    releaseBatch();
    await batchPromise;
  });

  it("isolates failures with Promise.allSettled", async () => {
    const sites = [baseSite("a", "Alpha"), baseSite("b", "Beta")];

    vi.mocked(runGbpSitePostBatch)
      .mockResolvedValueOnce({
        published: 1,
        queued: 0,
        failed: 0,
        lastPreview: null,
        resolvedTopic: "",
        inventoryHosted: null,
      })
      .mockRejectedValueOnce(new Error("publish failed"));

    const result = await runGbpMultiSiteBatch({
      sites,
      scheduler: testScheduler,
      openRouterApiKey: "test-key",
      sitemapSource: "pages",
    });

    expect(result.published).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.propertiesAttempted).toBe(2);
  });
});
