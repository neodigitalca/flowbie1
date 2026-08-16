import { describe, expect, it, vi } from "vitest";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import {
  countBlankEntityKeywordRows,
  fillEntitySlotKeywordsFromGsc,
  keywordTargetsFromPreloadedSapRows,
} from "@/lib/local-analysis/entity-preload-clusters-hydrate";
import { finalizeEntitySapRowsForAdGroups } from "@/lib/local-analysis/sap-entity-ad-groups";

vi.mock("@/lib/local-analysis/entity-site-warm-cache", () => ({
  ensureEntitySiteWarmCache: vi.fn(),
  gscQueriesFromWarmBundleForSapBudget: vi.fn(() => [
    { query: "blinds near me", clicks: 1, impressions: 10 },
  ]),
}));

vi.mock("@/lib/local-analysis/entity-sap-row-keyword-fill", () => ({
  fillEntitySapRowKeywordsFromInventoryAndGsc: vi.fn(async ({ rows }: { rows: CSVRow[] }) =>
    rows.map((row, i) => ({ ...row, keyword: row.keyword || `kw-${i}` })),
  ),
}));

import {
  ensureEntitySiteWarmCache,
  gscQueriesFromWarmBundleForSapBudget,
} from "@/lib/local-analysis/entity-site-warm-cache";
import { fillEntitySapRowKeywordsFromInventoryAndGsc } from "@/lib/local-analysis/entity-sap-row-keyword-fill";

function row(entity: string, keyword = ""): CSVRow {
  return { entity, keyword, title: "", meta: "", slug: "" };
}

const mockSite = {
  id: "site-1",
  name: "Test",
  siteUrl: "https://example.com",
  username: "u",
  appPassword: "p",
} as const;

describe("keywordTargetsFromPreloadedSapRows", () => {
  it("builds one target per ad group with correct sapPages", () => {
    const rows = finalizeEntitySapRowsForAdGroups([
      row("Southland Mall, Winkler, MB"),
      row("Southland Mall, Winkler, MB"),
      row("Southland Mall, Winkler, MB"),
      row("Mountain Ave, Winkler, MB"),
      row("Mountain Ave, Winkler, MB"),
      row("Mountain Ave, Winkler, MB"),
    ]);
    let n = 0;
    const targets = keywordTargetsFromPreloadedSapRows(rows, () => `t-${++n}`);
    expect(targets).toHaveLength(2);
    expect(targets.map((t) => t.entityHint).sort()).toEqual(
      ["Mountain Ave, Winkler, MB", "Southland Mall, Winkler, MB"].sort(),
    );
    expect(targets.every((t) => t.sapPages === 3)).toBe(true);
    expect(targets.every((t) => t.clusterRole === "seed")).toBe(true);
  });
});

describe("countBlankEntityKeywordRows", () => {
  it("counts entity rows missing keywords", () => {
    expect(countBlankEntityKeywordRows([row("A"), row("B", "k")])).toBe(1);
  });
});

describe("fillEntitySlotKeywordsFromGsc", () => {
  it("throws when OpenRouter key is missing", async () => {
    await expect(
      fillEntitySlotKeywordsFromGsc({
        site: mockSite,
        apiKey: "",
        model: "m",
        siteName: "Test",
        siteUrl: "https://example.com",
        rows: [row("Southland Mall, Winkler, MB")],
        gridLocations: ["Winkler"],
      }),
    ).rejects.toThrow(/OpenRouter/i);
  });

  it("throws when GSC queries are empty", async () => {
    vi.mocked(gscQueriesFromWarmBundleForSapBudget).mockReturnValueOnce([]);
    vi.mocked(ensureEntitySiteWarmCache).mockResolvedValue({
      inventory: {
        totalRows: 10,
        links: [],
        buckets: {},
      },
      gsc: { queries: [], dateRange: undefined },
      error: undefined,
    } as Awaited<ReturnType<typeof ensureEntitySiteWarmCache>>);

    await expect(
      fillEntitySlotKeywordsFromGsc({
        site: mockSite,
        apiKey: "key",
        model: "m",
        siteName: "Test",
        siteUrl: "https://example.com",
        rows: [row("Southland Mall, Winkler, MB")],
        gridLocations: ["Winkler"],
      }),
    ).rejects.toThrow(/Google Search Console returned no keywords/i);
  });

  it("returns filled rows when warm cache and fill succeed", async () => {
    vi.mocked(ensureEntitySiteWarmCache).mockResolvedValue({
      inventory: {
        totalRows: 10,
        links: [{ href: "https://example.com/p", label: "Page" }],
        buckets: { pages: [] },
      },
      gsc: { queries: [{ query: "blinds", clicks: 1, impressions: 10 }], dateRange: undefined },
      error: undefined,
    } as Awaited<ReturnType<typeof ensureEntitySiteWarmCache>>);

    const { rows } = await fillEntitySlotKeywordsFromGsc({
      site: mockSite,
      apiKey: "key",
      model: "m",
      siteName: "Test",
      siteUrl: "https://example.com",
      rows: finalizeEntitySapRowsForAdGroups([
        row("Southland Mall, Winkler, MB"),
        row("Southland Mall, Winkler, MB"),
      ]),
      gridLocations: ["Winkler"],
    });

    expect(rows.every((r) => r.keyword?.trim())).toBe(true);
    expect(fillEntitySapRowKeywordsFromInventoryAndGsc).toHaveBeenCalled();
  });

  it("throws when fill leaves blank entity keywords", async () => {
    vi.mocked(ensureEntitySiteWarmCache).mockResolvedValue({
      inventory: {
        totalRows: 10,
        links: [],
        buckets: {},
      },
      gsc: { queries: [{ query: "blinds", clicks: 1, impressions: 10 }], dateRange: undefined },
      error: undefined,
    } as Awaited<ReturnType<typeof ensureEntitySiteWarmCache>>);

    vi.mocked(fillEntitySapRowKeywordsFromInventoryAndGsc).mockResolvedValueOnce([
      row("Southland Mall, Winkler, MB", ""),
    ]);

    await expect(
      fillEntitySlotKeywordsFromGsc({
        site: mockSite,
        apiKey: "key",
        model: "m",
        siteName: "Test",
        siteUrl: "https://example.com",
        rows: [row("Southland Mall, Winkler, MB")],
        gridLocations: ["Winkler"],
      }),
    ).rejects.toThrow(/blank row/i);
  });
});
