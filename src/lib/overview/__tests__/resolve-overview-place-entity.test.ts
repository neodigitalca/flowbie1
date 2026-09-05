import { describe, expect, it, vi, beforeEach } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import { createEmptyOverviewRow } from "@/lib/overview/overview-row-helpers";
import { resolveOverviewPlaceEntityForRow } from "@/lib/overview/resolve-overview-place-entity";

vi.mock("@/hooks/content-optimization/bulk-seo-extra-text-fast-path", () => ({
  lookupOverviewInventoryHitForUrl: vi.fn(),
}));

import { lookupOverviewInventoryHitForUrl } from "@/hooks/content-optimization/bulk-seo-extra-text-fast-path";

const site = {
  id: "wp-test",
  name: "Acme Plumbing",
  siteUrl: "https://example.com",
} as WordPressSite;

beforeEach(() => {
  vi.mocked(lookupOverviewInventoryHitForUrl).mockReset();
});

describe("resolveOverviewPlaceEntityForRow", () => {
  it("returns undefined for posts tab", async () => {
    const row = createEmptyOverviewRow("https://example.com/blog/post/");
    const entity = await resolveOverviewPlaceEntityForRow({
      row,
      site,
      sitemapSource: "posts",
    });
    expect(entity).toBeUndefined();
    expect(lookupOverviewInventoryHitForUrl).not.toHaveBeenCalled();
  });

  it("reads ACF origin for SAP rows", async () => {
    const url = "https://example.com/plumbing-edmonton/";
    const row = {
      ...createEmptyOverviewRow(url),
      focusKeyword: "plumbing",
    };

    vi.mocked(lookupOverviewInventoryHitForUrl).mockReturnValue({
      row: {
        id: 1,
        url,
        slug: "plumbing-edmonton",
        acf: { origin: "Edmonton, AB" },
        fields: { title: "Plumbing Edmonton", meta: "", keyword: "" },
      },
      source: "entity",
    });

    const entity = await resolveOverviewPlaceEntityForRow({
      row,
      site,
      sitemapSource: "sap",
    });

    expect(entity).toBe("Edmonton, AB");
  });

  it("falls back to urlEntities cache when ACF origin is empty", async () => {
    const url = "https://example.com/hvac-calgary/";
    const row = createEmptyOverviewRow(url);

    vi.mocked(lookupOverviewInventoryHitForUrl).mockReturnValue({
      row: {
        id: 2,
        url,
        slug: "hvac-calgary",
        fields: { title: "HVAC Calgary", meta: "", keyword: "" },
      },
      source: "entity",
    });

    const entity = await resolveOverviewPlaceEntityForRow({
      row,
      site,
      sitemapSource: "sap",
      urlEntities: { [url]: "Calgary, AB" },
    });

    expect(entity).toBe("Calgary, AB");
  });
});
