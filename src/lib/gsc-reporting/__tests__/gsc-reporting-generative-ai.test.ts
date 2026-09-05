import { describe, expect, it } from "vitest";
import type { GscManualAiPayload } from "@/lib/gsc-manual-ai-aggregate";
import {
  GSC_GENERATIVE_AI_PAGES_FILENAME,
  GSC_GENERATIVE_AI_SITE_TOTALS_FILENAME,
  isGenerativeAiReportingFile,
  parseGenerativeAiBundleFromApi,
  seedHasGenerativeAiFiles,
  shouldIncludeGenerativeAiSection,
} from "@/lib/gsc-reporting/gsc-reporting-generative-ai";
import {
  applyGenerativeAiSectionGate,
  defaultSectionsFromPayload,
} from "@/lib/gsc-reporting/gsc-reporting-outline";
import { getGscReportingSectionSystemPrompt } from "@/lib/gsc-reporting/gsc-reporting-section-prompts";

const emptyPayload: GscManualAiPayload = {
  executiveSummary: "x",
  topOpportunities: [],
  clusters: [],
};

describe("shouldIncludeGenerativeAiSection", () => {
  it("omits when unavailable", () => {
    expect(shouldIncludeGenerativeAiSection({ available: false, reason: "unsupported" })).toBe(false);
  });

  it("omits when impressions are zero", () => {
    expect(
      shouldIncludeGenerativeAiSection({
        available: true,
        aggregatePrimary: {
          label: "Mar 2026",
          startDate: "2026-03-01",
          endDate: "2026-03-31",
          clicks: 0,
          impressions: 0,
          ctr: 0,
          position: 0,
        },
      }),
    ).toBe(false);
  });

  it("includes when available and impressions > 0", () => {
    expect(
      shouldIncludeGenerativeAiSection({
        available: true,
        aggregatePrimary: {
          label: "Mar 2026",
          startDate: "2026-03-01",
          endDate: "2026-03-31",
          clicks: 0,
          impressions: 12,
          ctr: 0,
          position: 0,
        },
      }),
    ).toBe(true);
  });
});

describe("parseGenerativeAiBundleFromApi", () => {
  it("parses available false", () => {
    expect(parseGenerativeAiBundleFromApi({ available: false, reason: "nope" })).toEqual({
      available: false,
      reason: "nope",
    });
  });

  it("parses aggregate and pages", () => {
    const b = parseGenerativeAiBundleFromApi({
      available: true,
      searchType: "generativeAi",
      aggregatePrimary: {
        label: "Mar",
        startDate: "2026-03-01",
        endDate: "2026-03-31",
        clicks: 1,
        impressions: 9,
        ctr: 0.1,
        position: 2,
      },
      pagesPrimary: [{ page: "https://ex.com/a", clicks: 0, impressions: 9, ctr: 0, position: 1 }],
    });
    expect(b?.available).toBe(true);
    expect(b?.aggregatePrimary?.impressions).toBe(9);
    expect(b?.pagesPrimary?.[0]?.page).toBe("https://ex.com/a");
  });
});

describe("seedHasGenerativeAiFiles", () => {
  it("requires exact Generative AI filenames", () => {
    expect(seedHasGenerativeAiFiles([{ name: "Pages-MoM.csv" }])).toBe(false);
    expect(seedHasGenerativeAiFiles([{ name: GSC_GENERATIVE_AI_PAGES_FILENAME }])).toBe(true);
    expect(isGenerativeAiReportingFile(GSC_GENERATIVE_AI_SITE_TOTALS_FILENAME)).toBe(true);
  });
});

describe("generative_ai_impressions outline gate", () => {
  it("omits section by default", () => {
    const s = defaultSectionsFromPayload(emptyPayload);
    expect(s.map((x) => x.kind)).not.toContain("generative_ai_impressions");
    expect(s).toHaveLength(6);
    expect(s[0]!.kind).toBe("executive_summary");
    expect(s[1]!.kind).toBe("search_performance_period");
  });

  it("inserts after executive_summary when included", () => {
    const s = defaultSectionsFromPayload(emptyPayload, "mom", { includeGenerativeAi: true });
    expect(s).toHaveLength(7);
    expect(s[0]!.kind).toBe("executive_summary");
    expect(s[1]!.kind).toBe("generative_ai_impressions");
    expect(s[1]!.h2Title).toBe("Generative AI Search Impressions");
    expect(s[2]!.kind).toBe("search_performance_period");
  });

  it("strips AI section when gate is false", () => {
    const withAi = defaultSectionsFromPayload(emptyPayload, "mom", { includeGenerativeAi: true });
    const gated = applyGenerativeAiSectionGate(withAi, false, "mom");
    expect(gated.map((x) => x.kind)).not.toContain("generative_ai_impressions");
  });
});

describe("generative_ai_impressions prompts", () => {
  it("requires GenerativeAI CSVs and forbids web KPI mix-in", () => {
    const sys = getGscReportingSectionSystemPrompt("generative_ai_impressions");
    expect(sys).toMatch(/GenerativeAI/i);
    expect(sys).toMatch(/Site-totals-MoM\.csv|Pages-MoM\.csv|Queries-MoM\.csv/);
  });
});
