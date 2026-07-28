import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SitePostInventoryRow } from "@/lib/wordpress-api/types";
import { suggestKeywordTargetsFromInventory } from "../local-analysis-suggest-from-inventory";
import { seedMasterInstructionsForTests, clearMasterInstructionsTestCache } from "../master-instructions-storage";

/** First JSON object in user message (before optional --- grid attachments). */
function parseSuggestUserJsonBlock(userMsg: string): Record<string, unknown> {
  const sep = userMsg.indexOf("\n\n--- ");
  const jsonPart = sep >= 0 ? userMsg.slice(0, sep) : userMsg;
  return JSON.parse(jsonPart.trim()) as Record<string, unknown>;
}

/** First `fetch` to OpenRouter (skips debug ingest and other non-chat POSTs). */
function parseFirstOpenRouterRequestBody(fetchMock: ReturnType<typeof vi.fn>): {
  messages: { role: string; content: string }[];
} {
  for (const call of fetchMock.mock.calls) {
    const init = call[1] as { body?: string } | undefined;
    if (!init?.body) continue;
    try {
      const o = JSON.parse(init.body) as { messages?: { role: string; content: string }[] };
      if (Array.isArray(o.messages)) return o as { messages: { role: string; content: string }[] };
    } catch {
      continue;
    }
  }
  throw new Error("No OpenRouter chat completion request in fetch mock");
}

function mockFetchResponse(
  clusters: Array<{
    seedKeyword: string;
    sapPagesSeed: number;
    wikiEntityHint?: string;
    members?: { keyword: string }[];
  }>,
) {
  const body = JSON.stringify({
    clusters: clusters.map((c) => ({
      seedKeyword: c.seedKeyword,
      wikiEntityHint: c.wikiEntityHint ?? "Test Place",
      sapPagesSeed: c.sapPagesSeed,
      members: c.members ?? [],
    })),
  });
  return {
    json: async () => ({
      choices: [{ message: { content: body } }],
    }),
  };
}

function mockFetchForSuggest(
  clusters: Array<{
    seedKeyword: string;
    sapPagesSeed: number;
    wikiEntityHint?: string;
    members?: { keyword: string }[];
  }>,
): ReturnType<typeof vi.fn> {
  return vi.fn(async () => mockFetchResponse(clusters));
}

describe("suggestKeywordTargetsFromInventory", () => {
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      mockFetchForSuggest([
        { seedKeyword: "custom blinds", sapPagesSeed: 5 },
        { seedKeyword: "roller shades", sapPagesSeed: 5 },
      ]) as unknown as typeof fetch,
    );
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    clearMasterInstructionsTestCache();
    vi.unstubAllGlobals();
  });

  it("returns repaired allocation from model JSON (research model path)", async () => {
    const posts: SitePostInventoryRow[] = [
      {
        url: "https://e.com/1",
        fields: { title: "Any title", meta: "", keyword: "any" },
      },
    ];
    const rows = await suggestKeywordTargetsFromInventory(posts, 10, {
      apiKey: "test-key",
      siteId: "s1",
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.reduce((s, r) => s + r.sapPages, 0)).toBe(10);
  });

  it("uses grid weights in the prompt (fetch receives post + grid payload)", async () => {
    const posts: SitePostInventoryRow[] = [
      {
        url: "https://e.com/1",
        fields: { title: "T", meta: "", keyword: "k" },
      },
    ];
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      mockFetchForSuggest([
        { seedKeyword: "chiropractic near me", sapPagesSeed: 3 },
        { seedKeyword: "other a", sapPagesSeed: 3 },
        { seedKeyword: "other b", sapPagesSeed: 3 },
        { seedKeyword: "other c", sapPagesSeed: 3 },
      ]),
    );
    await suggestKeywordTargetsFromInventory(posts, 12, {
      apiKey: "test-key",
      businessName: "Test Clinic",
      businessWebsiteUrl: "https://example.com",
      dataForSeoGmbGoogleBusinessInfoLiveJson: '{"tasks":[]}',
      gridKeywordWeights: [
        { keyword: "chiropractic near me", weight: 40 },
        { keyword: "other", weight: 5 },
      ],
    });
    const reqBody = parseFirstOpenRouterRequestBody(fetch as unknown as ReturnType<typeof vi.fn>);
    const userMsg = reqBody.messages.find((m: { role: string }) => m.role === "user")?.content ?? "";
    expect(userMsg).toContain("chiropractic near me");
    expect(userMsg).toContain("gridKeywordsWithWeaknessWeight");
    const userObj = parseSuggestUserJsonBlock(userMsg) as {
      gridKeywordsWithWeaknessWeight: { keyword: string; weight: number }[];
    };
    expect(userObj.gridKeywordsWithWeaknessWeight[0].keyword).toBe("chiropractic near me");
    expect(userObj.gridKeywordsWithWeaknessWeight[1].keyword).toBe("other");
  });

  it("includes DataForSEO GMB JSON block before grid attachments when provided", async () => {
    const posts: SitePostInventoryRow[] = [
      {
        url: "https://e.com/1",
        fields: { title: "T", meta: "", keyword: "k" },
      },
    ];
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      mockFetchForSuggest([
        { seedKeyword: "solar installation near me", sapPagesSeed: 5, wikiEntityHint: "Place A, Edmonton, AB" },
        { seedKeyword: "residential solar quote", sapPagesSeed: 5, wikiEntityHint: "Place B, Calgary, AB" },
      ]),
    );
    await suggestKeywordTargetsFromInventory(posts, 10, {
      apiKey: "test-key",
      businessName: "Solar Co",
      businessWebsiteUrl: "https://solar.example",
      dataForSeoGmbGoogleBusinessInfoLiveJson: '{"tasks":[{"result":[{"items":[]}]}]}',
      gridKeywordWeights: [{ keyword: "solar install", weight: 10 }],
      gridSummaryMarkdown: "## scan",
      uploadedGridCsvFull: "k,r\na,1",
    });
    const reqBody = parseFirstOpenRouterRequestBody(fetch as unknown as ReturnType<typeof vi.fn>);
    const userMsg = reqBody.messages.find((m: { role: string }) => m.role === "user")?.content ?? "";
    const jsonEnd = userMsg.indexOf("\n\n--- DataForSEO google_my_business_info");
    expect(jsonEnd).toBeGreaterThan(0);
    expect(userMsg).toContain("tasks");
    expect(userMsg.indexOf("--- Grid scan")).toBeGreaterThan(userMsg.indexOf("DataForSEO google_my_business_info"));
  });

  it("includes Client / audience context after GMB and before grid when provided", async () => {
    const posts: SitePostInventoryRow[] = [
      {
        url: "https://e.com/1",
        fields: { title: "T", meta: "", keyword: "k" },
      },
    ];
    await suggestKeywordTargetsFromInventory(posts, 10, {
      apiKey: "test-key",
      businessName: "Acme",
      businessWebsiteUrl: "https://acme.example",
      dataForSeoGmbGoogleBusinessInfoLiveJson: "{}",
      clientAudienceContextMarkdown: "**Audience:** homeowners 35–55.",
      gridSummaryMarkdown: "## scan",
    });
    const reqBody = parseFirstOpenRouterRequestBody(fetch as unknown as ReturnType<typeof vi.fn>);
    const userMsg = reqBody.messages.find((m: { role: string }) => m.role === "user")?.content ?? "";
    expect(userMsg).toContain("--- Client / audience context ---");
    expect(userMsg.indexOf("Client / audience context")).toBeGreaterThan(
      userMsg.indexOf("DataForSEO google_my_business_info"),
    );
    expect(userMsg.indexOf("--- Grid scan")).toBeGreaterThan(userMsg.indexOf("--- Client / audience context"));
    expect(userMsg).toContain("Audience:");
  });

  it("includes Wikipedia granular block before grid RAG (markdown + CSV) when city scope and pool provided", async () => {
    const posts: SitePostInventoryRow[] = [
      {
        url: "https://e.com/1",
        fields: { title: "T", meta: "", keyword: "k" },
      },
    ];
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      mockFetchForSuggest([
        { seedKeyword: "solar panel install", sapPagesSeed: 5, wikiEntityHint: "Whyte Avenue" },
        { seedKeyword: "home solar assessment", sapPagesSeed: 5, wikiEntityHint: "Downtown Edmonton" },
      ]),
    );
    await suggestKeywordTargetsFromInventory(posts, 10, {
      apiKey: "test-key",
      businessName: "Solar Co",
      businessWebsiteUrl: "https://solar.example",
      dataForSeoGmbGoogleBusinessInfoLiveJson: '{"tasks":[{"result":[{"items":[]}]}]}',
      gridKeywordWeights: [{ keyword: "solar install", weight: 10 }],
      gridSummaryMarkdown: "## scan",
      uploadedGridCsvFull: "k,r\na,1",
      wikipediaGranularEntityPoolMarkdown:
        "### Whyte Avenue\n- URL: https://en.wikipedia.org/wiki/Whyte_Avenue\n\n### Downtown Edmonton\n- URL: https://en.wikipedia.org/wiki/Downtown_Edmonton",
    });
    const reqBody = parseFirstOpenRouterRequestBody(fetch as unknown as ReturnType<typeof vi.fn>);
    const userMsg = reqBody.messages.find((m: { role: string }) => m.role === "user")?.content ?? "";
    const iGmb = userMsg.indexOf("--- DataForSEO google_my_business_info");
    const iWiki = userMsg.indexOf("--- Wikipedia granular place candidates");
    const iGrid = userMsg.indexOf("--- Grid scan");
    const iCsv = userMsg.indexOf("--- Uploaded grid CSV");
    expect(iWiki).toBeGreaterThan(iGmb);
    expect(iGrid).toBeGreaterThan(iWiki);
    expect(iCsv).toBeGreaterThan(iGrid);
    expect(userMsg).toContain("Whyte Avenue");
    const systemMsg =
      reqBody.messages.find((m: { role: string }) => m.role === "system")?.content ?? "";
    expect(systemMsg).toContain("Wikipedia granular candidate block");
    expect(systemMsg).toContain("Grid RAG");
  });

  it("includes seedRankedKeywordsFromDataForSeo in user payload when option is set", async () => {
    const posts: SitePostInventoryRow[] = [
      {
        url: "https://e.com/1",
        fields: { title: "T", meta: "", keyword: "k" },
      },
    ];
    await suggestKeywordTargetsFromInventory(posts, 10, {
      apiKey: "test-key",
      siteId: "s1",
      seedRankedKeywordsFromDataForSeo: [
        { phrase: "solar panels edmonton", volume: 100, traffic: 10, position: 5 },
        { phrase: "residential solar alberta", volume: 50, traffic: 5, position: 8 },
      ],
    });
    const reqBody = parseFirstOpenRouterRequestBody(fetch as unknown as ReturnType<typeof vi.fn>);
    const userMsg = reqBody.messages.find((m: { role: string }) => m.role === "user")?.content ?? "";
    const userObj = parseSuggestUserJsonBlock(userMsg) as {
      seedRankedKeywordsFromDataForSeo?: { phrase: string }[];
    };
    expect(userObj.seedRankedKeywordsFromDataForSeo?.length).toBe(2);
    expect(userObj.seedRankedKeywordsFromDataForSeo?.[0]?.phrase).toBe("solar panels edmonton");
    const systemMsg =
      reqBody.messages.find((m: { role: string }) => m.role === "system")?.content ?? "";
    expect(systemMsg).toContain("seedRankedKeywordsFromDataForSeo");
  });

  it("includes focusKeyword in JSON payload and system prompt when set", async () => {
    const posts: SitePostInventoryRow[] = [
      {
        url: "https://e.com/1",
        fields: { title: "T", meta: "", keyword: "k" },
      },
    ];
    await suggestKeywordTargetsFromInventory(posts, 10, {
      apiKey: "test-key",
      siteId: "s1",
      focusKeyword: "ductless mini split",
    });
    const reqBody = parseFirstOpenRouterRequestBody(fetch as unknown as ReturnType<typeof vi.fn>);
    const userMsg = reqBody.messages.find((m: { role: string }) => m.role === "user")?.content ?? "";
    const userObj = parseSuggestUserJsonBlock(userMsg) as { focusKeyword?: string };
    expect(userObj.focusKeyword).toBe("ductless mini split");
    const systemMsg =
      reqBody.messages.find((m: { role: string }) => m.role === "system")?.content ?? "";
    expect(systemMsg).toContain("focusKeyword");
  });

  it("includes focusLocation in JSON payload and system prompt when set", async () => {
    const posts: SitePostInventoryRow[] = [
      {
        url: "https://e.com/1",
        fields: { title: "T", meta: "", keyword: "k" },
      },
    ];
    await suggestKeywordTargetsFromInventory(posts, 10, {
      apiKey: "test-key",
      siteId: "s1",
      focusLocation: "Edmonton, AB",
    });
    const reqBody = parseFirstOpenRouterRequestBody(fetch as unknown as ReturnType<typeof vi.fn>);
    const userMsg = reqBody.messages.find((m: { role: string }) => m.role === "user")?.content ?? "";
    const userObj = parseSuggestUserJsonBlock(userMsg) as { focusLocation?: string };
    expect(userObj.focusLocation).toBe("Edmonton, AB");
    const systemMsg =
      reqBody.messages.find((m: { role: string }) => m.role === "system")?.content ?? "";
    expect(systemMsg).toContain("focusLocation");
  });

  it("appends client master instructions to the first suggest system message when loaded for the site", async () => {
    const siteId = "test-master-rules-site";
    const stubLs = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
    vi.stubGlobal("localStorage", stubLs as Storage);
    vi.stubGlobal(
      "window",
      {
        location: { origin: "http://localhost" },
        localStorage: stubLs,
      } as unknown as Window,
    );
    seedMasterInstructionsForTests(siteId, {
      sources: [{ name: "brand.txt", content: "Brand voice: mention rebates.", uploadedAt: Date.now() }],
    });
    try {
      const posts: SitePostInventoryRow[] = [
        {
          url: "https://e.com/1",
          fields: { title: "T", meta: "", keyword: "k" },
        },
      ];
      await suggestKeywordTargetsFromInventory(posts, 10, {
        apiKey: "test-key",
        siteId,
      });
      const reqBody = parseFirstOpenRouterRequestBody(fetch as unknown as ReturnType<typeof vi.fn>);
      const systemMsg =
        reqBody.messages.find((m: { role: string }) => m.role === "system")?.content ?? "";
      expect(systemMsg).toContain("CLIENT MASTER INSTRUCTIONS");
      expect(systemMsg).toContain("Brand voice: mention rebates.");
      expect(systemMsg).toContain("source of truth");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("omits 65-70% focusKeyword split when master rules are present", async () => {
    const siteId = "test-master-focus-kw-site";
    const stubLs = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
    vi.stubGlobal("localStorage", stubLs as Storage);
    vi.stubGlobal(
      "window",
      {
        location: { origin: "http://localhost" },
        localStorage: stubLs,
      } as unknown as Window,
    );
    seedMasterInstructionsForTests(siteId, {
      sources: [
        {
          name: "mix.txt",
          content: "60% interior design keywords, 30% custom blinds keywords.",
          uploadedAt: Date.now(),
        },
      ],
    });
    try {
      const posts: SitePostInventoryRow[] = [
        {
          url: "https://e.com/1",
          fields: { title: "T", meta: "", keyword: "k" },
        },
      ];
      await suggestKeywordTargetsFromInventory(posts, 10, {
        apiKey: "test-key",
        siteId,
        focusKeyword: "interior design",
        gridKeywordWeights: [{ keyword: "blinds", weight: 8 }],
        gridSummaryMarkdown: "## Grid",
        uploadedGridCsvFull: "Keyword,Rank\nblinds,5",
        businessName: "Blinds Co",
        businessWebsiteUrl: "https://blinds.example",
      });
      const reqBody = parseFirstOpenRouterRequestBody(fetch as unknown as ReturnType<typeof vi.fn>);
      const systemMsg =
        reqBody.messages.find((m: { role: string }) => m.role === "system")?.content ?? "";
      const userMsg = reqBody.messages.find((m: { role: string }) => m.role === "user")?.content ?? "";
      const userObj = parseSuggestUserJsonBlock(userMsg) as {
        sapAllocationRule?: string;
        focusKeywordUiHintSecondary?: string;
        focusKeyword?: string;
        clientMasterInstructionsExcerpt?: string;
      };
      expect(systemMsg).toContain("CLIENT MASTER INSTRUCTIONS");
      expect(systemMsg).not.toContain("65% to 70%");
      expect(systemMsg).toContain("Keyword theme mix (Master Rules)");
      expect(systemMsg).toContain("percentage splits");
      expect(systemMsg).toContain("Multiple clusters + Master Rules");
      expect(systemMsg).toContain("distinct service-line theme");
      expect(userObj.sapAllocationRule).toBeUndefined();
      expect(userObj.focusKeywordUiHintSecondary).toBe("interior design");
      expect(userObj.focusKeyword).toBeUndefined();
      expect(userObj.clientMasterInstructionsExcerpt).toContain("60% interior design");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("system prompt has no hardcoded example city names (Calgary-style guard)", async () => {
    const posts: SitePostInventoryRow[] = [
      {
        url: "https://e.com/1",
        fields: { title: "T", meta: "", keyword: "k" },
      },
    ];
    await suggestKeywordTargetsFromInventory(posts, 10, {
      apiKey: "test-key",
      siteId: "s1",
    });
    const reqBody = parseFirstOpenRouterRequestBody(fetch as unknown as ReturnType<typeof vi.fn>);
    const systemMsg =
      reqBody.messages.find((m: { role: string }) => m.role === "system")?.content ?? "";
    const lower = systemMsg.toLowerCase();
    expect(lower).not.toContain("calgary");
    expect(lower).not.toContain("beltline");
    expect(lower).not.toContain("kensington");
  });

  it("appends full grid markdown and full CSV after the JSON block when provided", async () => {
    const posts: SitePostInventoryRow[] = [
      {
        url: "https://e.com/1",
        fields: { title: "T", meta: "", keyword: "k" },
      },
    ];
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      mockFetchForSuggest([
        { seedKeyword: "solar panel install", sapPagesSeed: 5, wikiEntityHint: "Area One, Edmonton, AB" },
        { seedKeyword: "residential solar quote", sapPagesSeed: 5, wikiEntityHint: "Area Two, St Albert, AB" },
      ]),
    );
    await suggestKeywordTargetsFromInventory(posts, 10, {
      apiKey: "test-key",
      businessName: "Solar Co",
      businessWebsiteUrl: "https://solar.example",
      dataForSeoGmbGoogleBusinessInfoLiveJson: "{}",
      gridKeywordWeights: [{ keyword: "solar", weight: 10 }],
      gridSummaryMarkdown: "## Local grid scan\n- All points",
      uploadedGridCsvFull: "Keyword,Rank\nsolar near me,5",
    });
    const reqBody = parseFirstOpenRouterRequestBody(fetch as unknown as ReturnType<typeof vi.fn>);
    const userMsg = reqBody.messages.find((m: { role: string }) => m.role === "user")?.content ?? "";
    expect(userMsg).toContain("--- Grid scan (full markdown, complete file) - grid RAG ---");
    expect(userMsg).toContain("## Local grid scan");
    expect(userMsg).toContain("--- Uploaded grid CSV (full file, verbatim) - grid RAG ---");
    expect(userMsg).toContain("Keyword,Rank");
    expect(parseSuggestUserJsonBlock(userMsg).gridKeywordsWithWeaknessWeight).toBeDefined();
  });
});
