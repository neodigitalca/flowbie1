import { describe, expect, it, vi, beforeEach } from "vitest";
import { FLO_FAQ_CLASS } from "@/lib/overview/overview-blog-faq-append";
import {
  directImportBodyFingerprint,
  prependDirectAnswerAndOverview,
  resolveDirectFeaturedImageMode,
  resolveDirectKeywordResearchFromAnalyze,
} from "@/lib/bulk/blog-import-direct-extras";

vi.mock("@/lib/overview/overview-blog-overview-prepend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/overview/overview-blog-overview-prepend")>();
  return {
    ...actual,
    generateAndPrependOverviewHtml: vi.fn(),
  };
});

import { generateAndPrependOverviewHtml } from "@/lib/overview/overview-blog-overview-prepend";

const mockPrepend = vi.mocked(generateAndPrependOverviewHtml);

const SITE = {
  id: "site-1",
  name: "KWB",
  siteUrl: "https://kwbllp.com",
  username: "u",
  appPassword: "p",
  connectedAt: 0,
} as const;

const BODY = `<h2>Why Succession Planning Matters</h2>
<p>A well-designed succession plan helps organizations:</p>
<table><thead><tr><th>Value Driver</th></tr></thead><tbody><tr><td>Profitability</td></tr></tbody></table>`;

describe("Direct extras around imported body", () => {
  beforeEach(() => {
    mockPrepend.mockReset();
  });

  it("defaults featured image to AI unless the row or form says otherwise", () => {
    expect(resolveDirectFeaturedImageMode({}, "y")).toBe("y");
    expect(resolveDirectFeaturedImageMode({}, undefined)).toBe("y");
    expect(resolveDirectFeaturedImageMode({ featuredImage: "n" }, "y")).toBe("n");
    expect(resolveDirectFeaturedImageMode({}, "n")).toBe("n");
    expect(resolveDirectFeaturedImageMode({ featuredImage: "google-maps" }, "y")).toBe("google-maps");
  });

  it("fingerprints imported body without Answer, Overview, or FAQ", () => {
    const withExtras = `<h2 id="answer">Answer</h2><p>Two sentence answer here.</p>
<h2 id="overview">Overview</h2><p>Lead</p>
${BODY}
<div class="${FLO_FAQ_CLASS}"><h2 id="faq">FAQ</h2><p>Intro</p></div>`;
    expect(directImportBodyFingerprint(withExtras)).toBe(directImportBodyFingerprint(BODY));
  });

  it("prepends Answer and Overview without changing body wording", async () => {
    mockPrepend.mockResolvedValue({
      html: `<h2 id="answer">Answer</h2><p>Succession planning prepares future leaders.</p>
<h2 id="overview">Overview</h2><p>This guide covers retention.</p>
${BODY}`,
      bodyH2Titles: ["Why Succession Planning Matters"],
      anchorMap: [],
    });
    const out = await prependDirectAnswerAndOverview({
      bodyHtml: BODY,
      articleTitle: "Succession Planning: Retention, Pt 2",
      focusKeyword: "succession planning",
      site: SITE,
      apiKey: "test-key",
    });
    expect(out).toContain("id=\"answer\"");
    expect(out).toContain("id=\"overview\"");
    expect(out).toContain("Profitability");
    expect(directImportBodyFingerprint(out)).toBe(directImportBodyFingerprint(BODY));
  });

  it("fails when Answer or Overview is missing", async () => {
    mockPrepend.mockResolvedValue({
      html: BODY,
      bodyH2Titles: ["Why Succession Planning Matters"],
      anchorMap: [],
    });
    await expect(
      prependDirectAnswerAndOverview({
        bodyHtml: BODY,
        articleTitle: "Title",
        focusKeyword: "succession planning",
        site: SITE,
        apiKey: "test-key",
      }),
    ).rejects.toThrow(/Answer section is empty/);
  });
});

describe("Direct keyword research when DataForSEO has no Labs data", () => {
  it("keeps the row keyword when Labs items are empty", () => {
    const resolved = resolveDirectKeywordResearchFromAnalyze(
      { keyword: "valuation and price drivers", title: "Newsletter For KWB" },
      null,
    );
    expect(resolved.keywordData.keyword).toBe("valuation and price drivers");
    expect(resolved.keywordData.searchVolume).toBe(0);
  });

  it("uses DataForSEO volume when Labs returns keyword_info", () => {
    const resolved = resolveDirectKeywordResearchFromAnalyze(
      { keyword: "succession planning", title: "Succession Planning: Pt 1" },
      {
        result: {
          primaryKeyword: "succession planning",
          keywordData: {
            keyword: "succession planning",
            difficulty: 35,
            searchVolume: 9900,
            cpc: 11.93,
            competition: "LOW",
            intent: "informational",
            relatedKeywords: [],
            serpFeatures: [],
          },
          semanticKeywords: [],
          searchIntent: "informational",
        },
        aiAnalysis: {
          keywordSuggestions: {
            primary: "succession planning",
            variations: [],
            longTail: [],
            semantic: [],
          },
          h2Suggestions: [],
          contentGaps: [],
          peopleAlsoAsk: [],
          researchLinks: [],
        },
        keywordsVolumeData: [],
      },
    );
    expect(resolved.keywordData.searchVolume).toBe(9900);
  });
});
