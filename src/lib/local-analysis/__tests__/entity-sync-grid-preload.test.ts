import { describe, expect, it } from "vitest";
import { syncPromptBlogRowsToCount } from "@/lib/bulk/prompt-blog-slots";
import {
  buildSyncPreloadRowsFromGrid,
  extractCompassClusterLabelsFromCityRows,
  syncAdGroupEntityLabelsFromGridRows,
} from "@/lib/local-analysis/entity-sync-grid-preload";
import { buildEntityAdGroupSections } from "@/lib/local-analysis/sap-entity-ad-groups";
import { parseLocalDominatorCsv, type LocalDominatorRow } from "@/lib/local-dominator-csv";

const GRID_CSV = `Keyword,Address,Latitude,Longitude,Rank
blinds near me,"195 Mountain Ave, Winkler, MB",49.181,-97.939,8
blinds near me,"210 Mountain Ave, Winkler, MB",49.182,-97.938,12
blinds near me,"Southland Mall, Winkler, MB",49.175,-97.945,15`;

const STREET_ONLY_WINKLER_CSV = `Keyword,Address,Latitude,Longitude,Rank
blinds near me,"145 1st St, Winkler, MB R6W 3M1",49.179,-97.933,1
blinds near me,"139 N Railway Ave, Winkler, MB R6W 1J4",49.179,-97.933,2
blinds near me,"325 Roblin Blvd E Unit A, Winkler, MB R6W 0K9",49.194,-97.933,1
blinds near me,"600 Centennial St, Winkler, MB R6W 1J4",49.194,-97.933,5`;

const MULTI_CITY_CSV = `Keyword,Address,Latitude,Longitude,Rank
blinds near me,"100 Main St, Altona, MB",49.104,-97.560,1
blinds near me,"200 Main St, Altona, MB",49.106,-97.562,2
blinds near me,"145 1st St, Winkler, MB",49.179,-97.933,1
blinds near me,"600 Centennial St, Winkler, MB",49.194,-97.933,5`;

const NH_FOCUS = ["Neighbourhoods and residential quarters"];
const CORRIDOR_FOCUS = ["Street-as-place corridors and main streets"];

const TEST_SITE = {
  id: "test-site",
  name: "Test",
  siteUrl: "https://example.com",
  username: "u",
  appPassword: "p",
} as import("@/components/integrations/types").WordPressSite;

function minimalGridRow(
  partial: Partial<LocalDominatorRow> & Pick<LocalDominatorRow, "address" | "latitude" | "longitude">,
): LocalDominatorRow {
  return {
    scanDate: "",
    keyword: "k",
    business: "",
    placeId: "",
    websiteUrl: "",
    scanSize: "",
    distance: 0,
    distanceMeasure: "",
    rank: 1,
    primaryCategory: "",
    secondaryCategories: "",
    ...partial,
  };
}

function gridRowsFromCsv(csv: string): LocalDominatorRow[] {
  const parsed = parseLocalDominatorCsv(csv);
  expect(parsed.error).toBeUndefined();
  return parsed.rows;
}

describe("syncAdGroupEntityLabelsFromGridRows", () => {
  it("returns non-street labels from grid with named places", () => {
    const labels = syncAdGroupEntityLabelsFromGridRows(
      gridRowsFromCsv(GRID_CSV),
      2,
      { wantsNeighbourhoods: true },
    );
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((l) => !/^(North|South)\s+(East|West)\s+/i.test(l))).toBe(true);
  });
});

describe("buildSyncPreloadRowsFromGrid", () => {
  it("leaves entity slots empty in Neighbourhoods mode until OpenRouter plans sub-ads", () => {
    const rows = syncPromptBlogRowsToCount([], 3);
    const next = buildSyncPreloadRowsFromGrid({
      rows,
      gridCsvText: GRID_CSV,
      entityTypeFocus: NH_FOCUS,
    });
    expect(next).toHaveLength(3);
    expect(next.every((r) => !r.entity?.trim())).toBe(true);
    expect(next.every((r) => !r.keyword?.trim())).toBe(true);
  });

  it("builds 2 AdGroup sections with 2 rows each when layout is 2x2 (corridors)", () => {
    const rows = syncPromptBlogRowsToCount([], 4);
    const next = buildSyncPreloadRowsFromGrid({
      rows,
      gridCsvText: MULTI_CITY_CSV,
      entityTypeFocus: CORRIDOR_FOCUS,
      site: TEST_SITE,
      adGroupCount: 2,
      adsPerGroup: 2,
    });
    const sections = buildEntityAdGroupSections(next);
    expect(sections).toHaveLength(2);
    expect(sections.every((s) => s.rowIndices.length === 2)).toBe(true);
    expect(new Set(sections.map((s) => s.entity.toLowerCase())).size).toBe(2);
    expect(next.every((r) => r.entity?.trim())).toBe(true);
    expect(next.every((r) => !r.keyword?.trim())).toBe(true);
  });

  it("builds 2 distinct AdGroup sections with 3 rows each when layout is 2x3 (corridors)", () => {
    const rows = syncPromptBlogRowsToCount([], 6);
    const next = buildSyncPreloadRowsFromGrid({
      rows,
      gridCsvText: MULTI_CITY_CSV,
      entityTypeFocus: CORRIDOR_FOCUS,
      site: TEST_SITE,
      adGroupCount: 2,
      adsPerGroup: 3,
    });
    const sections = buildEntityAdGroupSections(next);
    expect(sections).toHaveLength(2);
    expect(sections.every((s) => s.rowIndices.length === 3)).toBe(true);
    expect(new Set(sections.map((s) => s.entity.toLowerCase())).size).toBe(2);
    expect(next.filter((r) => r.entity?.trim())).toHaveLength(6);
    expect(next.every((r) => !r.keyword?.trim())).toBe(true);
  });

  it("assigns different cities to 2 ad groups on multi-city grid (corridors)", () => {
    const rows = syncPromptBlogRowsToCount([], 6);
    const next = buildSyncPreloadRowsFromGrid({
      rows,
      gridCsvText: MULTI_CITY_CSV,
      entityTypeFocus: CORRIDOR_FOCUS,
      site: TEST_SITE,
      adGroupCount: 2,
      adsPerGroup: 3,
    });
    const sections = buildEntityAdGroupSections(next);
    expect(sections).toHaveLength(2);
    const entities = sections.map((s) => s.entity.toLowerCase());
    expect(entities.some((e) => e.includes("altona"))).toBe(true);
    expect(entities.some((e) => e.includes("winkler"))).toBe(true);
    expect(new Set(entities).size).toBe(2);
  });

  it("leaves a single slot empty in Neighbourhoods mode until OpenRouter runs", () => {
    const rows = syncPromptBlogRowsToCount([], 1);
    const next = buildSyncPreloadRowsFromGrid({
      rows,
      gridCsvText: GRID_CSV,
      entityTypeFocus: NH_FOCUS,
    });
    expect(next).toHaveLength(1);
    expect(next[0]?.entity?.trim()).toBeFalsy();
    expect(next[0]?.keyword?.trim()).toBeFalsy();
  });

  it("preloads Winkler grid with 1 AdGroup and 2 Ads (corridors)", () => {
    const rows = syncPromptBlogRowsToCount([], 2);
    const next = buildSyncPreloadRowsFromGrid({
      rows,
      gridCsvText: STREET_ONLY_WINKLER_CSV,
      entityTypeFocus: CORRIDOR_FOCUS,
      site: TEST_SITE,
      suggestFocusLocation: "Winkler, MB",
      adGroupCount: 1,
      adsPerGroup: 2,
    });
    const sections = buildEntityAdGroupSections(next);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.rowIndices).toHaveLength(2);
    expect(next.every((r) => r.entity?.trim())).toBe(true);
    expect(next.every((r) => !r.keyword?.trim())).toBe(true);
    expect(sections[0]?.entity).toMatch(/Winkler/i);
  });
});

describe("extractCompassClusterLabelsFromCityRows", () => {
  it("returns quadrant labels for street-only grid pins", () => {
    const rows: LocalDominatorRow[] = [
      minimalGridRow({ address: "1 A St, Winkler, MB", latitude: 49.19, longitude: -97.94, rank: 5 }),
      minimalGridRow({ address: "2 B St, Winkler, MB", latitude: 49.17, longitude: -97.96, rank: 6 }),
    ];
    const labels = extractCompassClusterLabelsFromCityRows(rows, "Winkler, MB", 4);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels[0]).toMatch(/Winkler/i);
  });
});
