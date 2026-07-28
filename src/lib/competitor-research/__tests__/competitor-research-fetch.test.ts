import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  fetchCompetitorResearchForTab,
  fetchManualCompetitorDomainForTab,
} from "@/lib/competitor-research/competitor-research-fetch";
import type { CompetitorResearchSemrushResponse } from "@/lib/competitor-research/types";

vi.mock("@/lib/wordpress-api/connection", () => ({
  BACKEND_API_BASE: "https://api.example.com",
}));

const semrushSpy = vi.hoisted(() =>
  vi.fn(async (): Promise<CompetitorResearchSemrushResponse> => ({
    seedDomain: "seed.com",
    database: "us",
    rows: [],
    seedTopKeywords: [],
    seedDomainOrganicCsv: "",
    enrichmentByDomain: {},
    domainOrganicCsvByDomain: {},
  })),
);

const manualSpy = vi.hoisted(() =>
  vi.fn(async () => ({
    row: { domain: "x.com" },
    enrichment: { keywords: [] },
    domainOrganicCsv: "a,b",
  })),
);

vi.mock("@/lib/competitor-research/competitor-semrush-client", () => ({
  fetchCompetitorResearchSemrush: semrushSpy,
  fetchManualCompetitorDomain: manualSpy,
}));

describe("competitor-research-fetch", () => {
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    semrushSpy.mockClear();
    manualSpy.mockClear();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it("fetchCompetitorResearchForTab uses Semrush client when semrushEnhanced", async () => {
    await fetchCompetitorResearchForTab({
      semrushEnhanced: true,
      siteUrl: "https://seed.com",
      displayLimit: 10,
    });
    expect(semrushSpy).toHaveBeenCalledWith({
      siteUrl: "https://seed.com",
      portfolioBlockedHosts: undefined,
      displayLimit: 10,
      enrichmentLimit: undefined,
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("fetchCompetitorResearchForTab POSTs DataForSEO when not enhanced", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          seedDomain: "seed.com",
          database: "dfs",
          dataSource: "dfs",
          rows: [],
          seedTopKeywords: [],
          seedDomainOrganicCsv: "",
          enrichmentByDomain: {},
          domainOrganicCsvByDomain: {},
        }),
        { status: 200 },
      ),
    );
    const out = await fetchCompetitorResearchForTab({
      semrushEnhanced: false,
      siteUrl: "https://seed.com",
      portfolioBlockedHosts: ["bad.com"],
      displayLimit: 5,
      enrichmentLimit: 3,
    });
    expect(semrushSpy).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.example.com/api/dataforseo/competitor-research",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          siteUrl: "https://seed.com",
          portfolioBlockedHosts: ["bad.com"],
          displayLimit: 5,
          enrichmentLimit: 3,
        }),
      }),
    );
    expect(out.database).toBe("dfs");
    expect(out.dataSource).toBe("dfs");
  });

  it("fetchManualCompetitorDomainForTab uses Semrush manual when enhanced", async () => {
    await fetchManualCompetitorDomainForTab({
      semrushEnhanced: true,
      domain: "a.com",
      siteUrl: "https://seed.com",
      database: "us",
    });
    expect(manualSpy).toHaveBeenCalledWith({
      domain: "a.com",
      siteUrl: "https://seed.com",
      database: "us",
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("fetchManualCompetitorDomainForTab POSTs manual-domain when not enhanced", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          row: { domain: "b.com" },
          enrichment: { keywords: [] },
          domainOrganicCsv: "x,y",
        }),
        { status: 200 },
      ),
    );
    const out = await fetchManualCompetitorDomainForTab({
      semrushEnhanced: false,
      domain: " b.com ",
      siteUrl: "https://seed.com",
    });
    expect(manualSpy).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.example.com/api/dataforseo/competitor-research/manual-domain",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          domain: "b.com",
          siteUrl: "https://seed.com",
        }),
      }),
    );
    expect(out.domainOrganicCsv).toBe("x,y");
  });
});
