import { describe, expect, it } from "vitest";
import {
  retrieveTopChunks,
  scoreChunkForRagQuery,
  splitGscFilesIntoChunks,
} from "@/lib/gsc-reporting/gsc-reporting-chunks";
import { applyCanonicalGscSectionTitles, defaultSectionsFromPayload } from "@/lib/gsc-reporting/gsc-reporting-outline";
import {
  buildUserMessageForSection,
  GSC_REPORTING_EXEC_SUMMARY_STYLE_LINE,
  GSC_REPORTING_SECTION_STYLE_LINE,
  getGscReportingSectionSystemPrompt,
} from "@/lib/gsc-reporting/gsc-reporting-section-prompts";
import type { GscManualAiPayload } from "@/lib/gsc-manual-ai-aggregate";
import type { GscReportingOutlineResult } from "@/lib/gsc-reporting/gsc-reporting-types";

describe("splitGscFilesIntoChunks", () => {
  it("creates at least one chunk per file", () => {
    const chunks = splitGscFilesIntoChunks([{ name: "q.csv", content: "a,b\n1,2\n" }]);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]!.sourceFile).toBe("q.csv");
    expect(chunks[0]!.text).toContain("FILE: q.csv");
  });
});

describe("scoreChunkForRagQuery", () => {
  it("scores higher when query tokens overlap chunk", () => {
    const low = scoreChunkForRagQuery("foo bar baz", "zzz");
    const high = scoreChunkForRagQuery("alberta modular homes tiny edmonton", "alberta modular homes");
    expect(high).toBeGreaterThan(low);
  });
});

describe("retrieveTopChunks", () => {
  it("returns chunks within budget", () => {
    const chunks = splitGscFilesIntoChunks([
      { name: "a.csv", content: "h\n" + Array.from({ length: 200 }, (_, i) => `row${i},data`).join("\n") },
    ]);
    const top = retrieveTopChunks({
      chunks,
      ragQuery: "row5 data",
      h2Title: "Test",
      maxChunks: 3,
      maxTotalChars: 5000,
    });
    expect(top.length).toBeGreaterThan(0);
    expect(top.length).toBeLessThanOrEqual(3);
  });
});

describe("getGscReportingSectionSystemPrompt", () => {
  it("mentions GFM tables for content_performance", () => {
    const s = getGscReportingSectionSystemPrompt("content_performance");
    expect(s).toMatch(/GitHub-Flavored Markdown|GFM/i);
  });

  it("cluster section does not instruct quoted query strings", () => {
    const s = getGscReportingSectionSystemPrompt("cluster");
    expect(s).not.toMatch(/quoted query/i);
    expect(s).toMatch(/no\*\* quote wrapping|quote wrapping around queries/i);
  });

  it("cluster section requires tables only, no bullet lists", () => {
    const s = getGscReportingSectionSystemPrompt("cluster");
    expect(s).toMatch(/CLUSTER LAYOUT/i);
    expect(s).toMatch(/Do \*\*not\*\* use bullet lists/i);
    expect(s).toMatch(/GFM pipe tables/i);
  });

  it("embeds executive audience rules in executive_summary", () => {
    const s = getGscReportingSectionSystemPrompt("executive_summary");
    expect(s).toMatch(/Non-technical executives|executives/i);
    expect(s).toMatch(/No.*site-wide KPI|Search performance/i);
  });

  it("search_performance_period owns the canonical KPI table", () => {
    const s = getGscReportingSectionSystemPrompt("search_performance_period");
    expect(s).toMatch(/canonical KPI table|owns/i);
  });

  it("sap_local_seo and content_performance require thematic page buckets, not one row per URL", () => {
    const sap = getGscReportingSectionSystemPrompt("sap_local_seo");
    const cp = getGscReportingSectionSystemPrompt("content_performance");
    expect(sap).toMatch(/one row per|entity sitemap|Page-first table/i);
    expect(cp).toMatch(/combined stages|theme|Forbidden.*one row per URL/i);
  });

  it("content_performance instructs sitemap-aware segment buckets", () => {
    const s = getGscReportingSectionSystemPrompt("content_performance");
    expect(s).toMatch(/GSC-sitemaps|sitemap-style buckets/i);
    expect(s).toMatch(/SEGMENT AGGREGATES/i);
  });
});

describe("buildUserMessageForSection", () => {
  it("appends executive-summary style line (prose-first, not default tables-first)", () => {
    const outline: GscReportingOutlineResult = {
      executiveSummary: "Summary text",
      topOpportunities: [],
      clusters: [],
      sections: [],
    };
    const msg = buildUserMessageForSection({
      siteName: "Example",
      siteUrl: "https://example.com",
      outline,
      plan: {
        id: "executive_summary",
        h2Title: "Executive Summary",
        kind: "executive_summary",
        ragQuery: "x",
      },
      retrievedContext: "csv data",
    });
    expect(msg.endsWith(GSC_REPORTING_EXEC_SUMMARY_STYLE_LINE)).toBe(true);
    expect(msg).toContain("RETRIEVED DATA");
  });

  it("appends default tables-first style for non-executive sections", () => {
    const outline: GscReportingOutlineResult = {
      executiveSummary: "",
      topOpportunities: [],
      clusters: [],
      sections: [],
    };
    const msg = buildUserMessageForSection({
      siteName: "Example",
      siteUrl: "https://example.com",
      outline,
      plan: {
        id: "search_performance_period",
        h2Title: "Search Performance Compared Month Over Month",
        kind: "search_performance_period",
        ragQuery: "x",
      },
      retrievedContext: "csv",
    });
    expect(msg.endsWith(GSC_REPORTING_SECTION_STYLE_LINE)).toBe(true);
  });

  it("appends Content override style for content_performance", () => {
    const outline: GscReportingOutlineResult = {
      executiveSummary: "",
      topOpportunities: [],
      clusters: [],
      sections: [],
    };
    const msg = buildUserMessageForSection({
      siteName: "Example",
      siteUrl: "https://example.com",
      outline,
      plan: {
        id: "content_performance",
        h2Title: "Content Performance: Your Growing Digital Footprint",
        kind: "content_performance",
        ragQuery: "x",
      },
      retrievedContext: "csv",
    });
    expect(msg).toContain("**Content override:**");
    expect(msg).toContain("sitemap / content-type");
  });

  it("reminds cluster sections to use tables only", () => {
    const outline: GscReportingOutlineResult = {
      executiveSummary: "",
      topOpportunities: [],
      clusters: [{ name: "Theme A", examples: ["a"], aggregate: "agg" }],
      sections: [],
    };
    const msg = buildUserMessageForSection({
      siteName: "Example",
      siteUrl: "https://example.com",
      outline,
      plan: {
        id: "cluster-0",
        h2Title: "Theme A",
        kind: "cluster",
        ragQuery: "x",
        clusterIndex: 0,
      },
      retrievedContext: "csv",
    });
    expect(msg).toContain("tables only");
    expect(msg).toContain("no bullet or numbered lists");
  });
});

describe("defaultSectionsFromPayload", () => {
  it("ends with content_performance (no FAQ, top opportunities, cluster, or all-search-terms sections)", () => {
    const p: GscManualAiPayload = {
      executiveSummary: "x",
      topOpportunities: [],
      clusters: [{ name: "Cluster A", examples: ["a", "b"], aggregate: "agg" }],
    };
    const s = defaultSectionsFromPayload(p);
    expect(s).toHaveLength(5);
    expect(s[0]!.kind).toBe("executive_summary");
    expect(s[0]!.h2Title).toBe("Executive Summary");
    expect(s[1]!.kind).toBe("search_performance_period");
    expect(s[1]!.h2Title).toBe("Search Performance Compared Month Over Month");
    expect(s[3]!.kind).toBe("sap_local_seo");
    expect(s[4]!.kind).toBe("content_performance");
    expect(s[4]!.h2Title).toBe("Content Performance: Your Growing Digital Footprint");
    expect(s.every((x) => x.kind !== "cluster")).toBe(true);
  });
});

describe("applyCanonicalGscSectionTitles", () => {
  it("strips date-stuffed search_performance titles from the model", () => {
    const out = applyCanonicalGscSectionTitles([
      {
        id: "search_performance_period",
        h2Title: "Search performance - Mar 2026 vs Feb 2026",
        kind: "search_performance_period",
        ragQuery: "x",
      },
    ]);
    expect(out[0]!.h2Title).toBe("Search Performance Compared Month Over Month");
  });

  it("leaves cluster section titles unchanged", () => {
    const out = applyCanonicalGscSectionTitles([
      {
        id: "c0",
        h2Title: "Theme: Local Demand",
        kind: "cluster",
        ragQuery: "y",
        clusterIndex: 0,
      },
    ]);
    expect(out[0]!.h2Title).toBe("Theme: Local Demand");
  });
});
