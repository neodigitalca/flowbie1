import { beforeEach, describe, expect, it, vi } from "vitest";
import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import {
  runLegacyRedirectMatchAgent,
  splitLegacySheetIntoLineChunks,
} from "@/lib/sitemap-optimizer/legacy-redirect-match-agent";
import { parseLegacyRedirectMatchAgentJson } from "@/lib/sitemap-optimizer/legacy-redirect-match-parse";
import { buildLegacyRedirectRankMathCsv } from "@/lib/sitemap-optimizer/legacy-redirect-export-csv";
import {
  buildLegacyRedirectMicroSnapshot,
  legacyRedirectHeaderProgressFromMatch,
} from "@/lib/sitemap-optimizer/legacy-redirect-header-progress";
import { LEGACY_REDIRECT_MATCH_BATCH_LINE_SIZE } from "@/lib/sitemap-optimizer/constants";
import type { SitePostInventoryKbPayload } from "@/lib/wordpress-api/types";

vi.mock("@/lib/competitor-research/competitor-report-openrouter", () => ({
  callOpenRouterChatCompletion: vi.fn(),
}));

vi.mock("@/lib/optimization-settings-storage", () => ({
  getResearchModel: () => "google/gemini-2.5-flash-lite",
}));

const mockCall = vi.mocked(callOpenRouterChatCompletion);

const legacyA = "https://example.com/2019/03/old-post/";
const legacyB = "https://example.com/2018/01/another-old/";
const destA = "https://example.com/blog/new-post/";
const destB = "https://example.com/about/";
const blogIndexUrl = "https://example.com/blog/";

const gscSheet = `URL
${legacyA}
${legacyB}`;

function agentArgs(overrides: Partial<Parameters<typeof runLegacyRedirectMatchAgent>[0]> = {}) {
  return {
    allowedDestinationUrls: [destA, destB],
    blogIndexUrl,
    siteInventory: inventoryPayload,
    apiKey: "test-key",
    siteId: "site-1",
    ...overrides,
  };
}

function matchAllFromPayload(user: string) {
  const payload = JSON.parse(user) as { allowedLegacyUrls: string[] };
  return {
    content: JSON.stringify({
      matches: payload.allowedLegacyUrls.map((legacyUrl) => ({
        legacyUrl,
        destinationUrl: destA,
      })),
    }),
  };
}

const inventoryPayload: SitePostInventoryKbPayload = {
  site: { url: "https://example.com" },
  generatedAt: "2026-01-01T00:00:00.000Z",
  posts: [
    {
      id: 1,
      slug: "new-post",
      url: destA,
      fields: { title: "New post", keyword: "new post" },
    },
    {
      id: 2,
      slug: "about",
      url: destB,
      fields: { title: "About", keyword: "about" },
    },
  ],
};

describe("parseLegacyRedirectMatchAgentJson", () => {
  it("parses matches array from JSON object", () => {
    const json = JSON.stringify({
      matches: [{ legacyUrl: legacyA, destinationUrl: destA }],
    });
    const rows = parseLegacyRedirectMatchAgentJson(json);
    expect(rows).toEqual([{ legacyUrl: legacyA, destinationUrl: destA }]);
  });

  it("throws on empty response", () => {
    expect(() => parseLegacyRedirectMatchAgentJson("")).toThrow(/empty/i);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseLegacyRedirectMatchAgentJson("{not json")).toThrow(/valid JSON/i);
  });
});

describe("buildLegacyRedirectRankMathCsv", () => {
  it("emits Rank Math import header and rows", () => {
    const csv = buildLegacyRedirectRankMathCsv([
      { legacyUrl: legacyA, destinationUrl: destA, uploadRow: 1 },
    ]);
    expect(csv.split("\n")[0]).toBe(
      "id,source,matching,destination,type,category,status,ignore",
    );
    expect(csv).toContain(legacyA);
    expect(csv).toContain(destA);
    expect(csv).toContain('"exact"');
    expect(csv).toContain('"301"');
  });
});

describe("splitLegacySheetIntoLineChunks", () => {
  it("splits lines into 10-url chunks", () => {
    const lines = Array.from({ length: 105 }, (_, i) => `https://example.com/page-${i}/`);
    const sheet = ["URL", ...lines].join("\n");
    const chunks = splitLegacySheetIntoLineChunks(sheet, LEGACY_REDIRECT_MATCH_BATCH_LINE_SIZE);
    expect(chunks.length).toBe(11);
  });
});

describe("buildLegacyRedirectMicroSnapshot", () => {
  it("builds URL progress pct from sheet line count", () => {
    const header = legacyRedirectHeaderProgressFromMatch(
      {
        phase: "match",
        completed: 40,
        total: 100,
        matchedCount: 40,
        batchesCompleted: 4,
        batchesTotal: 10,
      },
      100,
    );
    const snap = buildLegacyRedirectMicroSnapshot(header);
    expect(snap?.completed).toBe(40);
    expect(snap?.total).toBe(100);
    expect(snap?.progressPct).toBe(40);
    expect(snap?.statusMessage).toBe("40 / 100 URLs");
  });
});

describe("runLegacyRedirectMatchAgent", () => {
  beforeEach(() => {
    mockCall.mockReset();
  });

  it("sends allowed legacy URLs to the URL agent and accepts inventory destinations", async () => {
    mockCall.mockResolvedValue({
      content: JSON.stringify({
        matches: [
          { legacyUrl: legacyA, destinationUrl: destA },
          { legacyUrl: legacyB, destinationUrl: destB },
        ],
      }),
    });

    const rows = await runLegacyRedirectMatchAgent(
      agentArgs({ legacySheetText: gscSheet, legacySheetName: "coverage.csv" }),
    );

    expect(mockCall).toHaveBeenCalledTimes(1);
    const userPayload = JSON.parse(mockCall.mock.calls[0]![0].user);
    expect(userPayload.allowedLegacyUrls).toEqual([legacyA, legacyB]);
    expect(userPayload.requiredCount).toBe(2);
    expect(userPayload.blogIndexUrl).toBe(blogIndexUrl);
    expect(userPayload.legacySheetName).toBe("coverage.csv");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.destinationUrl).toBe(destA);
    expect(rows[1]?.destinationUrl).toBe(destB);
  });

  it("calls the URL agent once per 10-url chunk in order", async () => {
    const lines = Array.from({ length: 105 }, (_, i) => `https://example.com/legacy-${i}/`);
    const bigSheet = ["URL", ...lines].join("\n");

    mockCall.mockImplementation(async (args) => matchAllFromPayload(args.user));

    const onProgress = vi.fn();
    await runLegacyRedirectMatchAgent(
      agentArgs({ legacySheetText: bigSheet, onProgress }),
    );

    expect(mockCall.mock.calls.length).toBe(11);
    const callOrder = mockCall.mock.calls.map(
      (call) => JSON.parse(call[0]!.user).chunkIndex as number,
    );
    expect(callOrder).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
    expect(lastCall?.[0]).toBe(11);
    expect(lastCall?.[1]).toBe(11);
    expect(lastCall?.[2]).toBe(105);
  });

  it("counts duplicate legacy paths once per sheet line in progress", async () => {
    const dupSheet = [
      "https://example.com/same-path/",
      "https://www.example.com/same-path/",
    ].join("\n");
    mockCall.mockResolvedValue({
      content: JSON.stringify({
        matches: [{ legacyUrl: "https://example.com/same-path/", destinationUrl: destA }],
      }),
    });

    const onProgress = vi.fn();
    await runLegacyRedirectMatchAgent(
      agentArgs({ legacySheetText: dupSheet, onProgress }),
    );

    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
    expect(lastCall?.[2]).toBe(2);
  });

  it("runs URL agent batches in parallel", async () => {
    const lines = Array.from({ length: 30 }, (_, i) => `https://example.com/legacy-${i}/`);
    const bigSheet = lines.join("\n");
    let inFlight = 0;
    let maxInFlight = 0;

    mockCall.mockImplementation(async (args) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return matchAllFromPayload(args.user);
    });

    await runLegacyRedirectMatchAgent(agentArgs({ legacySheetText: bigSheet }));

    expect(mockCall.mock.calls.length).toBe(3);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it("accepts identity mapping for live inventory URLs", async () => {
    const live = "https://kwbllp.com/blog/monthly-business-coaching/";
    mockCall.mockResolvedValue({
      content: JSON.stringify({
        matches: [{ legacyUrl: live, destinationUrl: live }],
      }),
    });

    const rows = await runLegacyRedirectMatchAgent(
      agentArgs({
        legacySheetText: `${live}\n`,
        allowedDestinationUrls: [destA, live, destB],
      }),
    );

    expect(mockCall).toHaveBeenCalled();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.destinationUrl).toBe(live);
  });

  it("assigns every legacy URL including paths already in inventory", async () => {
    const wwwLive = "https://www.kwbllp.com/blog/financial-tax-planning-auto-repair/";
    const live = "https://kwbllp.com/blog/financial-tax-planning-auto-repair/";
    mockCall.mockResolvedValue({
      content: JSON.stringify({
        matches: [{ legacyUrl: wwwLive, destinationUrl: live }],
      }),
    });

    const rows = await runLegacyRedirectMatchAgent(
      agentArgs({
        legacySheetText: `${wwwLive}\n`,
        allowedDestinationUrls: [destA, live, destB],
      }),
    );

    expect(mockCall).toHaveBeenCalled();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.legacyUrl).toBe(wwwLive);
    expect(rows[0]?.destinationUrl).toBe(live);
  });

  it("assigns blog index legacy URLs through the agent", async () => {
    mockCall.mockImplementation(async (args) => matchAllFromPayload(args.user));

    const rows = await runLegacyRedirectMatchAgent(
      agentArgs({ legacySheetText: `${legacyA}\n${blogIndexUrl}\n` }),
    );

    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.legacyUrl).toBe(legacyA);
    expect(rows[1]?.legacyUrl).toBe(blogIndexUrl);
  });

  it("uses blogIndexUrl when the agent returns the same URL as legacy for pagination", async () => {
    const page = "https://example.com/blogs/5/";
    mockCall.mockResolvedValue({
      content: JSON.stringify({
        matches: [{ legacyUrl: page, destinationUrl: page }],
      }),
    });

    const rows = await runLegacyRedirectMatchAgent(
      agentArgs({ legacySheetText: `${page}\n` }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.destinationUrl).toBe(blogIndexUrl);
  });

  it("prefers slug inventory match over blog when the agent returns an unknown destination", async () => {
    const destSlug = "https://example.com/blog/old-post-updated/";
    mockCall.mockResolvedValue({
      content: JSON.stringify({
        matches: [
          { legacyUrl: legacyA, destinationUrl: "https://example.com/blog/wrong-page/" },
        ],
      }),
    });

    const rows = await runLegacyRedirectMatchAgent(
      agentArgs({
        legacySheetText: `${legacyA}\n`,
        allowedDestinationUrls: [destSlug, destB],
      }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.destinationUrl).toBe(destSlug);
  });

  it("resolves legacy slug overlap when agent proposes an inventory slug not in allowed list", async () => {
    const legacy =
      "https://www.kwbllp.com/2015/04/15/what-will-interest-rates-do-in-2015/";
    const canonical = "https://kwbllp.com/blog/interest-rates-2015/";
    mockCall.mockResolvedValue({
      content: JSON.stringify({
        matches: [{ legacyUrl: legacy, destinationUrl: canonical }],
      }),
    });

    const rows = await runLegacyRedirectMatchAgent(
      agentArgs({
        legacySheetText: `${legacy}\n`,
        allowedDestinationUrls: [canonical, destB],
      }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.destinationUrl).toBe(canonical);
  });

  it("never redirects to numbered WordPress clone slugs", async () => {
    const legacy =
      "https://example.com/2017/06/13/strategic-business-goal-setting/";
    const canonical = "https://example.com/blog/strategic-business-goal-setting/";
    const clone = "https://example.com/blog/strategic-business-goal-setting-2/";
    mockCall.mockResolvedValue({
      content: JSON.stringify({
        matches: [{ legacyUrl: legacy, destinationUrl: clone }],
      }),
    });

    const rows = await runLegacyRedirectMatchAgent(
      agentArgs({
        legacySheetText: `${legacy}\n`,
        allowedDestinationUrls: [clone, canonical, destB],
      }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.destinationUrl).not.toBe(clone);
    expect(rows[0]?.destinationUrl).toBe(canonical);
  });

  it("uses blogIndexUrl when the agent returns an unknown destination for pagination", async () => {
    const page = "https://example.com/blogs/33/";
    mockCall.mockResolvedValue({
      content: JSON.stringify({
        matches: [{ legacyUrl: page, destinationUrl: "https://example.com/blog/wrong-page/" }],
      }),
    });

    const rows = await runLegacyRedirectMatchAgent(
      agentArgs({ legacySheetText: `${page}\n` }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.destinationUrl).toBe(blogIndexUrl);
  });

  it("binds agent destinations when legacy URL strings do not match exactly", async () => {
    mockCall.mockResolvedValue({
      content: JSON.stringify({
        matches: [
          {
            legacyUrl: "https://other.example/not-the-same/",
            destinationUrl: destA,
          },
        ],
      }),
    });

    const rows = await runLegacyRedirectMatchAgent(
      agentArgs({ legacySheetText: `${legacyA}\n` }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.legacyUrl).toBe(legacyA);
    expect(rows[0]?.destinationUrl).toBe(destA);
  });

  it("dedupes repeated legacy URLs and keeps the first match", async () => {
    mockCall.mockResolvedValue({
      content: JSON.stringify({
        matches: [
          { legacyUrl: legacyA, destinationUrl: destA },
          { legacyUrl: legacyA.replace(/\/$/, ""), destinationUrl: destB },
        ],
      }),
    });

    const rows = await runLegacyRedirectMatchAgent(
      agentArgs({
        legacySheetText: `${legacyA}\n`,
        allowedDestinationUrls: [destA, destB],
      }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.legacyUrl).toBe(legacyA);
    expect(rows[0]?.destinationUrl).toBe(destA);
  });

  it("accepts path-only legacy URLs from the URL agent", async () => {
    mockCall.mockResolvedValue({
      content: JSON.stringify({
        matches: [{ legacyUrl: "darren-buma/", destinationUrl: destA }],
      }),
    });

    const rows = await runLegacyRedirectMatchAgent(
      agentArgs({ legacySheetText: "darren-buma/\n" }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.destinationUrl).toBe(destA);
  });

  it("uses blogIndexUrl for pagination and no-SEO destinations", async () => {
    const pageTwo = "https://example.com/blog/page/2/";
    mockCall.mockResolvedValue({
      content: JSON.stringify({
        matches: [{ legacyUrl: pageTwo, destinationUrl: blogIndexUrl }],
      }),
    });

    const rows = await runLegacyRedirectMatchAgent(
      agentArgs({ legacySheetText: `${pageTwo}\n` }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.destinationUrl).toBe(blogIndexUrl);
  });

  it("calls the URL agent once per chunk when OpenRouter fails (no re-ask)", async () => {
    mockCall.mockRejectedValueOnce(new Error("Unexpected end of JSON input"));

    const rows = await runLegacyRedirectMatchAgent(
      agentArgs({ legacySheetText: `URL\n${legacyA}` }),
    );

    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.destinationUrl).toBe("https://example.com/");
  });

  it("calls the URL agent once per chunk when finishReason is error with no rows", async () => {
    mockCall.mockResolvedValueOnce({
      content: "{",
      finishReason: "error",
    });

    const rows = await runLegacyRedirectMatchAgent(agentArgs({ legacySheetText: gscSheet }));

    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.destinationUrl === "https://example.com/")).toBe(true);
  });
});
