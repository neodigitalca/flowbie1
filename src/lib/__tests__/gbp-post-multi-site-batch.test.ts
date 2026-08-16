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

const okResult = {
  published: 1,
  queued: 0,
  failed: 0,
  lastPreview: null,
  resolvedTopic: "topic",
  inventoryHosted: null,
};

describe("runGbpMultiSiteBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs sites sequentially A–Z", async () => {
    const sites = [baseSite("a", "Alpha"), baseSite("b", "Beta"), baseSite("c", "Gamma")];
    const startOrder: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    vi.mocked(runGbpSitePostBatch)
      .mockImplementationOnce(async ({ site }) => {
        startOrder.push(site.id);
        await firstGate;
        return okResult;
      })
      .mockImplementation(async ({ site }) => {
        startOrder.push(site.id);
        return okResult;
      });

    const batchPromise = runGbpMultiSiteBatch({
      sites,
      scheduler: testScheduler,
      openRouterApiKey: "test-key",
      sitemapSource: "pages",
    });

    await vi.waitFor(() => expect(startOrder).toEqual(["a"]));
    releaseFirst();
    const result = await batchPromise;

    expect(startOrder).toEqual(["a", "b", "c"]);
    expect(result.propertiesAttempted).toBe(3);
    expect(result.published).toBe(3);
    expect(result.failed).toBe(0);
    expect(runGbpSitePostBatch).toHaveBeenCalledTimes(3);
  });

  it("calls onPropertyStart once per site before that site completes", async () => {
    const sites = [baseSite("a", "Alpha"), baseSite("b", "Beta")];
    const propertyStarts: string[] = [];

    vi.mocked(runGbpSitePostBatch).mockImplementation(async ({ site }) => {
      propertyStarts.push(`run-${site.id}`);
      return okResult;
    });

    await runGbpMultiSiteBatch({
      sites,
      scheduler: testScheduler,
      openRouterApiKey: "test-key",
      sitemapSource: "pages",
      onPropertyStart: (site) => {
        propertyStarts.push(`start-${site.id}`);
      },
    });

    expect(propertyStarts).toEqual(["start-a", "run-a", "start-b", "run-b"]);
  });

  it("isolates failures and continues to the next site", async () => {
    const sites = [baseSite("a", "Alpha"), baseSite("b", "Beta")];

    vi.mocked(runGbpSitePostBatch)
      .mockRejectedValueOnce(new Error("publish failed"))
      .mockResolvedValueOnce(okResult);

    const result = await runGbpMultiSiteBatch({
      sites,
      scheduler: testScheduler,
      openRouterApiKey: "test-key",
      sitemapSource: "pages",
    });

    expect(result.published).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.propertiesAttempted).toBe(2);
    expect(runGbpSitePostBatch).toHaveBeenCalledTimes(2);
  });
});
