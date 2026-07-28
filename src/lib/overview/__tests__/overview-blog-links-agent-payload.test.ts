import { describe, expect, it } from "vitest";
import {
  availableCandidateKeywordsForIntent,
  isNumberedSlugDuplicateHref,
  keywordCandidatesForAnchor,
  keywordCandidatesExcludingUsedUrls,
  resolveKeywordToPoolUrl,
  resolvePlanKeywordsFromPool,
  resolveReplaceDestination,
} from "@/lib/overview/overview-blog-links-agent-payload";
import type { BlogLinksSiteLinkPool } from "@/lib/overview/overview-blog-links-inventory";

const pool: BlogLinksSiteLinkPool = {
  postCount: 2,
  pageCount: 1,
  postInventory: [
    {
      url: "https://example.com/blog/tax-tips/",
      title: "Tax Tips",
      focusKeyword: "tax deductions",
      bucket: "post",
      slug: "tax-tips",
    },
    {
      url: "https://example.com/blog/holding-company/",
      title: "Holding Company",
      focusKeyword: "need a holding company",
      bucket: "post",
      slug: "holding-company",
    },
  ],
  pageInventory: [
    {
      url: "https://example.com/services/",
      title: "Services",
      focusKeyword: "accounting services",
      bucket: "page",
      slug: "services",
    },
  ],
};

describe("resolvePlanKeywordsFromPool", () => {
  it("maps proposedKeyword to full post url from cached pool", () => {
    const resolved = resolvePlanKeywordsFromPool(
      {
        linkActions: [
          {
            action: "replace",
            index: 0,
            proposedUrl: "tax deductions",
            rationale: "",
          },
        ],
      },
      pool,
    );
    expect(resolved.linkActions[0]?.proposedUrl).toBe("https://example.com/blog/tax-tips/");
  });
});

describe("keywordCandidatesForAnchor", () => {
  it("includes GSC keywords and anchor matches", () => {
    const sheet = keywordCandidatesForAnchor(
      "holding company",
      pool,
      ["tax planning", "corporate structure"],
    );
    expect(sheet).toContain("tax planning");
    expect(sheet).toContain("need a holding company");
  });
});

describe("isNumberedSlugDuplicateHref", () => {
  it("flags -2, -3, and -2-2 slug clones", () => {
    expect(
      isNumberedSlugDuplicateHref(
        "https://kwbllp.com/blog/strategic-business-goal-setting-2/",
      ),
    ).toBe(true);
    expect(isNumberedSlugDuplicateHref("https://example.com/blog/foo-3/")).toBe(true);
    expect(isNumberedSlugDuplicateHref("https://example.com/blog/foo-2-2/")).toBe(true);
  });

  it("allows primary slugs without numbered clone suffix", () => {
    expect(
      isNumberedSlugDuplicateHref("https://kwbllp.com/blog/strategic-business-goal-setting/"),
    ).toBe(false);
    expect(isNumberedSlugDuplicateHref("https://example.com/blog/foo-1/")).toBe(false);
  });
});

describe("availableCandidateKeywordsForIntent", () => {
  it("drops keywords that resolve to numbered slug clones", () => {
    const clonePool: BlogLinksSiteLinkPool = {
      postCount: 2,
      pageCount: 0,
      postInventory: [
        {
          url: "https://kwbllp.com/blog/strategic-business-goal-setting-2/",
          title: "Strategic Goals Clone",
          focusKeyword: "strategic goals",
          bucket: "post",
          slug: "strategic-business-goal-setting-2",
        },
        {
          url: "https://kwbllp.com/blog/strategic-business-goal-setting/",
          title: "Strategic Goals",
          focusKeyword: "strategic business goals",
          bucket: "post",
          slug: "strategic-business-goal-setting",
        },
      ],
      pageInventory: [],
    };
    const sheet = keywordCandidatesForAnchor("strategic goals", clonePool, ["strategic goals"]);
    const filtered = availableCandidateKeywordsForIntent(
      sheet,
      clonePool,
      "https://kwbllp.com",
      [],
      "https://kwbllp.com/blog/other-topic/",
    );
    expect(filtered).not.toContain("strategic goals");
    expect(filtered).toContain("strategic business goals");
  });

  it("drops keywords that resolve to the source article URL", () => {
    const selfPool: BlogLinksSiteLinkPool = {
      postCount: 2,
      pageCount: 0,
      postInventory: [
        {
          url: "https://kwbllp.com/blog/auto-repair-swot/",
          title: "Auto Repair SWOT",
          focusKeyword: "auto repair SWOT analysis",
          bucket: "post",
          slug: "auto-repair-swot",
        },
        {
          url: "https://kwbllp.com/blog/how-to-complete-a-swot-analysis/",
          title: "How to SWOT",
          focusKeyword: "how to complete SWOT",
          bucket: "post",
          slug: "how-to-complete-a-swot-analysis",
        },
      ],
      pageInventory: [],
    };
    const sheet = keywordCandidatesForAnchor("SWOT analysis", selfPool, ["SWOT analysis"]);
    const filtered = availableCandidateKeywordsForIntent(
      sheet,
      selfPool,
      "https://kwbllp.com",
      [],
      "https://kwbllp.com/blog/auto-repair-swot/",
    );
    expect(filtered).not.toContain("auto repair SWOT analysis");
    expect(filtered).toContain("how to complete SWOT");
  });
});

describe("keywordCandidatesExcludingUsedUrls", () => {
  it("removes keyword lines that resolve to used destination URLs", () => {
    const sheet = keywordCandidatesForAnchor("holding company", pool, ["tax planning"]);
    const filtered = keywordCandidatesExcludingUsedUrls(
      sheet,
      pool,
      "https://example.com",
      ["https://example.com/blog/tax-tips/"],
    );
    expect(filtered).not.toContain("tax deductions");
    expect(filtered).toContain("need a holding company");
  });

  it("excludes SWOT how-to keyword when that URL is already linked", () => {
    const swotPool: BlogLinksSiteLinkPool = {
      postCount: 3,
      pageCount: 0,
      postInventory: [
        {
          url: "https://kwbllp.com/blog/how-to-complete-a-swot-analysis/",
          title: "How to Complete a SWOT Analysis",
          focusKeyword: "how to complete SWOT",
          bucket: "post",
          slug: "how-to-complete-a-swot-analysis",
        },
        {
          url: "https://kwbllp.com/blog/strategic-business-goal-setting-2/",
          title: "Strategic Business Goal Setting",
          focusKeyword: "strategic goals",
          bucket: "post",
          slug: "strategic-business-goal-setting-2",
        },
        {
          url: "https://kwbllp.com/blog/swot-analysis-and-strategic-business-goal-setting-auto-repair/",
          title: "SWOT Auto Repair",
          focusKeyword: "auto repair SWOT analysis",
          bucket: "post",
          slug: "swot-analysis-and-strategic-business-goal-setting-auto-repair",
        },
      ],
      pageInventory: [],
    };
    const sheet = keywordCandidatesForAnchor("SWOT analysis", swotPool, ["SWOT analysis"]);
    const filtered = keywordCandidatesExcludingUsedUrls(
      sheet,
      swotPool,
      "https://kwbllp.com",
      ["https://kwbllp.com/blog/how-to-complete-a-swot-analysis/"],
    );
    expect(filtered).not.toContain("how to complete SWOT");
    expect(filtered).toContain("strategic goals");
  });
});

describe("resolveReplaceDestination", () => {
  it("resolves anchor phrase to pool url excluding current href", () => {
    const url = resolveReplaceDestination(
      "need a holding company",
      "holding company",
      "post",
      pool,
      "https://example.com",
      "https://example.com/blog/integrated-financial-planning/",
    );
    expect(url).toBe("https://example.com/blog/holding-company/");
  });

  it("falls back to slug match when keyword differs slightly", () => {
    const url = resolveKeywordToPoolUrl(
      "tax tips",
      pool,
      "post",
      "https://example.com",
    );
    expect(url).toBe("https://example.com/blog/tax-tips/");
  });
});
