import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import { createEmptyOverviewRow } from "@/lib/overview/overview-row-helpers";
import {
  getOverviewRowsSessionCache,
  setOverviewRowsSessionCache,
} from "@/lib/overview/overview-rows-session-cache";

const siteId = "site-a";

function cachedRows(): OverviewRow[] {
  return [
    {
      ...createEmptyOverviewRow("https://example.com/post-a/"),
      title: "Post A",
      focusKeyword: "widgets",
      wpDateGmt: "2024-01-01T00:00:00",
    },
    {
      ...createEmptyOverviewRow("https://example.com/post-b/"),
      title: "Post B",
      focusKeyword: "gadgets",
      dateModifier: "2024-02-01",
    },
  ];
}

describe("useOverviewTabSitemapLoad contract", () => {
  it("tab open reads session cache only; no validation gates or tab-open hydrate", () => {
    const src = readFileSync(
      resolve(__dirname, "../use-overview-tab-sitemap-load.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/paintPrefetchUrls/);
    expect(src).not.toMatch(/applyUrlBatch/);
    expect(src).not.toMatch(/applyPrefetchMetadata/);
    expect(src).not.toMatch(/firstUrlBatchPainted/);
    expect(src).not.toMatch(/buildOverviewUrlShellRows/);
    expect(src).not.toMatch(/ensureEntitySiteWarmInventory/);
    expect(src).not.toMatch(/overviewSessionRowsDisplayReady/);
    expect(src).not.toMatch(/hydrateOverviewContentInBackground/);
    expect(src).not.toMatch(/buildOverviewRowsFromWarmPrefetchInventory/);
    expect(src).not.toMatch(/force:\s*sourceChanged/);
    expect(src).toMatch(/includeContent:\s*false/);
    expect(src).toMatch(/if \(cachedRows\?\.length\)/);
  });

  it("session cache hit returns rows without clearing grid", () => {
    setOverviewRowsSessionCache(siteId, "posts", cachedRows());
    const rows = getOverviewRowsSessionCache(siteId, "posts");
    expect(rows?.length).toBe(2);
    expect(rows?.[0]?.title).toBe("Post A");
  });
});
