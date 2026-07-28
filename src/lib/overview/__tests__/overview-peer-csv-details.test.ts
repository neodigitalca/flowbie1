import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPeerSitesPlanFile,
  formatPeerSitesChecklistStatus,
  formatPeerSitesPlanMarkdown,
  mergeGeneratedFilesByName,
  partitionPeerDetailFiles,
  peerLocalImagesCsvFileName,
  shouldShowDetailsFlatGeneratedFiles,
} from "@/lib/overview/overview-peer-csv-details";
import { buildSapPeerLibraryCsvFile } from "@/lib/overview/sap-cross-site-image-search";

describe("mergeGeneratedFilesByName", () => {
  it("merges without duplicating the same CSV name", () => {
    const existing = [
      {
        name: "peer-local-images-heritage.csv",
        content: "a",
        mimeType: "text/csv",
      },
    ];
    const incoming = [
      {
        name: "peer-local-images-heritage.csv",
        content: "b",
        mimeType: "text/csv",
      },
      {
        name: "in-content-image.md",
        content: "# ok",
        mimeType: "text/markdown;charset=utf-8",
      },
    ];
    const merged = mergeGeneratedFilesByName(existing, incoming);
    expect(merged).toHaveLength(2);
    expect(merged.find((f) => f.name === "peer-local-images-heritage.csv")?.content).toBe(
      "b",
    );
    expect(merged.some((f) => f.name === "in-content-image.md")).toBe(true);
  });
});

describe("peerLocalImagesCsvFileName", () => {
  it("matches buildSapPeerLibraryCsvFile for the same site name", () => {
    const site = {
      name: "Heritage Dental Centre",
      siteUrl: "https://heritagedentaledmonton.ca",
    };
    const built = buildSapPeerLibraryCsvFile(site, []);
    expect(peerLocalImagesCsvFileName(site.name)).toBe(built.name);
  });
});

describe("partitionPeerDetailFiles", () => {
  it("exposes one combined CSV and keeps non-peer files separate", () => {
    const peers = [
      { name: "Heritage Dental Centre", siteUrl: "https://heritagedentaledmonton.ca" },
      { name: "Phoenix Painting", siteUrl: "https://phoenixpainting.ca" },
    ];
    const combinedCsv = {
      name: "peer-local-images.csv",
      content: "site,title\nHeritage,x\nPhoenix,y",
      mimeType: "text/csv",
    };
    const plan = buildPeerSitesPlanFile({
      entity: "Edmonton City Centre",
      peers,
    });
    const other = {
      name: "in-content-analyze.md",
      content: "# a",
      mimeType: "text/markdown;charset=utf-8",
    };
    const legacyPerSite = {
      name: "peer-local-images-orphan-site.csv",
      content: "o",
      mimeType: "text/csv",
    };

    const partitioned = partitionPeerDetailFiles({
      peers,
      files: [plan, combinedCsv, other, legacyPerSite],
    });

    expect(partitioned.planFile?.name).toBe("peer-sites-to-scrape.md");
    expect(partitioned.combinedCsvFile?.name).toBe("peer-local-images.csv");
    expect(partitioned.summaryFile).toBeNull();
    expect(partitioned.rows).toHaveLength(2);
    expect(partitioned.otherFiles.map((f) => f.name)).toEqual(["in-content-analyze.md"]);
  });

  it("exposes local-image-summary.md as summaryFile", () => {
    const summary = {
      name: "local-image-summary.md",
      content: "# Local Image Summary\n",
      mimeType: "text/markdown;charset=utf-8",
    };
    const partitioned = partitionPeerDetailFiles({
      peers: [],
      files: [summary],
    });
    expect(partitioned.summaryFile?.name).toBe("local-image-summary.md");
    expect(partitioned.otherFiles).toEqual([]);
  });
});

describe("formatPeerSitesChecklistStatus", () => {
  it("points to batch Details download without listing names", () => {
    const text = formatPeerSitesChecklistStatus({
      entity: "Edmonton City Centre",
      peerCount: 3,
    });
    expect(text).toContain("City peers: 3");
    expect(text).toContain("sitemap plan");
    expect(text).not.toContain("Heritage");
  });
});

describe("formatPeerSitesPlanMarkdown", () => {
  it("lists peer site markdown links before crawl", () => {
    const md = formatPeerSitesPlanMarkdown({
      entity: "Edmonton City Centre",
      peers: [
        { name: "Heritage Dental", siteUrl: "https://heritagedentaledmonton.ca" },
        { name: "Phoenix Painting", siteUrl: "https://phoenixpainting.ca" },
      ],
    });
    expect(md).toContain("Edmonton City Centre");
    expect(md).toContain("[Heritage Dental](https://heritagedentaledmonton.ca)");
    expect(md).toContain("[Phoenix Painting](https://phoenixpainting.ca)");
    expect(
      buildPeerSitesPlanFile({
        entity: "Edmonton City Centre",
        peers: [
          { name: "Heritage Dental", siteUrl: "https://heritagedentaledmonton.ca" },
        ],
      }).name,
    ).toBe("peer-sites-to-scrape.md");
  });
});

describe("shouldShowDetailsFlatGeneratedFiles", () => {
  const base = {
    isDetailsOnly: true,
    showOptimizationSequence: false,
    harnessSectionCount: 4,
    generatedFileCount: 2,
    peerSiteCount: 0,
    isActive: true,
    isWarmingUp: false,
    isDetailsActivePost: true,
    isCompleted: false,
    isSkipped: false,
    isError: false,
  };

  it("shows details flat body for parallel Local Image when files/harness exist", () => {
    expect(shouldShowDetailsFlatGeneratedFiles(base)).toBe(true);
  });

  it("shows when only peer site links are present", () => {
    expect(
      shouldShowDetailsFlatGeneratedFiles({
        ...base,
        harnessSectionCount: 0,
        generatedFileCount: 0,
        peerSiteCount: 3,
      }),
    ).toBe(true);
  });

  it("stays hidden when details-only has no harness and no files", () => {
    expect(
      shouldShowDetailsFlatGeneratedFiles({
        ...base,
        harnessSectionCount: 0,
        generatedFileCount: 0,
        peerSiteCount: 0,
      }),
    ).toBe(false);
  });

  it("shows when showOptimizationSequence is already true", () => {
    expect(
      shouldShowDetailsFlatGeneratedFiles({
        ...base,
        isDetailsOnly: false,
        showOptimizationSequence: true,
        harnessSectionCount: 0,
        generatedFileCount: 0,
      }),
    ).toBe(true);
  });
});

describe("onPeerPlanReady before crawl", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("fires peer plan before DFS and before full library crawl finishes", async () => {
    const planReady = vi.fn();
    const csvReady = vi.fn();
    const peerCsv = {
      name: "peer-local-images-heritage-dental.csv",
      content: "site,title\nHeritage,Edmonton City Centre\n",
      mimeType: "text/csv;charset=utf-8",
    };
    const heritage = {
      id: "peer1",
      name: "Heritage Dental",
      siteUrl: "https://heritagedentaledmonton.ca",
      username: "u",
      appPassword: "p",
      entitySitemapUrl: "https://heritagedentaledmonton.ca/entity-sitemap.xml",
    };

    vi.doMock("@/lib/api", () => ({ loadApiKey: () => "test-key" }));
    vi.doMock("@/lib/optimization-settings-storage", () => ({
      getResearchModel: () => "test-model",
    }));
    vi.doMock("@/lib/overview/sap-cross-site-image-search", () => ({
      isCurrentConnectedSite: () => false,
      searchSapCrossSiteInContentImage: vi.fn(
        async (params: {
          onPeerPlanReady?: (peers: Array<{ name: string; siteUrl: string }>) => void;
          onPeerCsvReady?: (file: typeof peerCsv) => void;
        }) => {
          params.onPeerPlanReady?.([
            { name: heritage.name, siteUrl: heritage.siteUrl },
          ]);
          params.onPeerCsvReady?.(peerCsv);
          return { hit: null, peerCsvFiles: [peerCsv] };
        },
      ),
    }));
    vi.doMock("@/lib/wikipedia/mediawiki-pageimage", () => ({
      fetchWikipediaPageLeadImage: vi.fn(async () => null),
    }));
    vi.doMock("@/lib/image-reference-research", () => ({
      researchGoogleImageReferences: vi.fn(async () => {
        throw new Error("DFS should not run before onPeerLibrariesReady");
      }),
    }));

    const { generateLocalInContentImageFromHtml } = await import(
      "@/lib/overview/overview-blog-local-image-generate"
    );

    const site = {
      id: "write",
      name: "Blind Magic",
      siteUrl: "https://blindmagic.com",
      username: "u",
      appPassword: "p",
    };

    await expect(
      generateLocalInContentImageFromHtml({
        html: "<h2>Overview</h2><p>x</p><h2>About Edmonton City Centre</h2><p>y</p>",
        site: site as never,
        entity: "Edmonton City Centre",
        pageUrl: "https://blindmagic.com/edmonton-city-centre/",
        focusKeyword: "blinds edmonton city centre",
        apiKey: "test-key",
        peerSites: [heritage as never],
        localImageMode: "generate",
        onPeerPlanReady: planReady,
        onPeerCsvReady: csvReady,
      }),
    ).rejects.toThrow(/DFS should not run before onPeerLibrariesReady|No image references/);

    expect(planReady).toHaveBeenCalled();
    expect(planReady.mock.calls[0]?.[0]?.[0]?.siteUrl).toBe(heritage.siteUrl);
    expect(csvReady).toHaveBeenCalledWith(peerCsv);
  });
});
