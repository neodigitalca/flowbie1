import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  loadApiKey: () => "test-key",
}));

vi.mock("@/lib/optimization-settings-storage", () => ({
  getResearchModel: () => "test-model",
}));

vi.mock("@/lib/overview/sap-cross-site-image-search", () => ({
  isCurrentConnectedSite: () => false,
  searchSapCrossSiteInContentImage: vi.fn(),
}));

vi.mock("@/lib/wordpress-api", () => ({
  uploadWordPressMedia: vi.fn(),
}));

vi.mock("@/lib/image-api", () => ({
  generateImage: vi.fn(),
}));

vi.mock("@/lib/wikipedia/mediawiki-pageimage", () => ({
  fetchWikipediaPageLeadImage: vi.fn(),
}));

const htmlWithH2 = `<h2>Overview</h2><p>Body</p>`;

describe("generateLocalInContentImageFromHtml onLocalImagePhase", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/images/fetch-data-url")) {
          return {
            ok: true,
            json: async () => ({ dataUrl: "data:image/jpeg;base64,aaaa" }),
          } as Response;
        }
        if (url.includes("/api/images/prepare-local-image")) {
          return {
            ok: true,
            json: async () => ({
              dataUrl: "data:image/jpeg;base64,aaaa",
              width: 1600,
              height: 900,
              upscaled: false,
            }),
          } as Response;
        }
        throw new Error(`Unexpected fetch: ${url} ${init?.method || ""}`);
      }),
    );
  });

  it("emits looking → found → reusing when peer hit uploads", async () => {
    const { searchSapCrossSiteInContentImage } = await import(
      "@/lib/overview/sap-cross-site-image-search"
    );
    const { uploadWordPressMedia } = await import("@/lib/wordpress-api");

    vi.mocked(searchSapCrossSiteInContentImage).mockResolvedValue({
      hit: {
        imageUrl: "https://cdn.example.com/peer.jpg",
        sourceSiteName: "Heritage Dental Centre",
        sourceSiteUrl: "https://heritagedentaledmonton.ca",
        sourcePageUrl: "https://heritagedentaledmonton.ca/edmonton-city-centre/",
        score: 3,
      },
      peerCsvFiles: [],
    });
    vi.mocked(uploadWordPressMedia).mockResolvedValue({
      success: true,
      url: "https://blindmagic.com/wp-content/uploads/x.jpg",
      mediaId: 99,
    });

    const phases: Array<{ phase: string; detail?: string }> = [];
    const { generateLocalInContentImageFromHtml } = await import(
      "@/lib/overview/overview-blog-local-image-generate"
    );

    await generateLocalInContentImageFromHtml({
      html: htmlWithH2,
      site: {
        id: "bm",
        name: "Blind Magic",
        siteUrl: "https://blindmagic.com",
        username: "u",
        appPassword: "p",
      } as never,
      entity: "Edmonton City Centre",
      focusKeyword: "hunter douglas blinds edmonton city centre",
      forcedSectionHeader: "Overview",
      apiKey: "test-key",
      peerSites: [
        {
          id: "heritage",
          name: "Heritage Dental Centre",
          siteUrl: "https://heritagedentaledmonton.ca",
          username: "u",
          appPassword: "p",
          entitySitemapUrl: "https://heritagedentaledmonton.ca/sitemap.xml",
        } as never,
      ],
      onLocalImagePhase: (info) => {
        phases.push({ phase: info.phase, detail: info.detail });
      },
    });

    expect(phases.map((p) => p.phase)).toEqual(["looking", "found", "reusing"]);
    expect(phases[0]?.detail).toContain("city peers");
    expect(phases[1]?.detail).toContain("Heritage Dental Centre");
    expect(phases[2]?.detail).toContain("Uploading");
  });

  it("emits looking → not_found when peers miss (find mode)", async () => {
    const { searchSapCrossSiteInContentImage } = await import(
      "@/lib/overview/sap-cross-site-image-search"
    );
    vi.mocked(searchSapCrossSiteInContentImage).mockResolvedValue({
      hit: null,
      peerCsvFiles: [],
    });

    const phases: Array<{ phase: string; detail?: string }> = [];
    const { generateLocalInContentImageFromHtml } = await import(
      "@/lib/overview/overview-blog-local-image-generate"
    );

    await expect(
      generateLocalInContentImageFromHtml({
        html: htmlWithH2,
        site: {
          id: "bm",
          name: "Blind Magic",
          siteUrl: "https://blindmagic.com",
          username: "u",
          appPassword: "p",
        } as never,
        entity: "Edmonton City Centre",
        apiKey: "test-key",
        localImageMode: "find",
        peerSites: [
          {
            id: "heritage",
            name: "Heritage Dental Centre",
            siteUrl: "https://heritagedentaledmonton.ca",
            username: "u",
            appPassword: "p",
            entitySitemapUrl: "https://heritagedentaledmonton.ca/sitemap.xml",
          } as never,
        ],
        onLocalImagePhase: (info) => {
          phases.push({ phase: info.phase, detail: info.detail });
        },
      }),
    ).rejects.toThrow(/No shared Local Image/);

    expect(phases.map((p) => p.phase)).toEqual(["looking", "not_found"]);
  });

  it("throws on peer hit when prefetch fails and never calls Wikipedia or generateImage", async () => {
    const { searchSapCrossSiteInContentImage } = await import(
      "@/lib/overview/sap-cross-site-image-search"
    );
    const { generateImage } = await import("@/lib/image-api");
    const { fetchWikipediaPageLeadImage } = await import(
      "@/lib/wikipedia/mediawiki-pageimage"
    );

    vi.mocked(searchSapCrossSiteInContentImage).mockResolvedValue({
      hit: {
        imageUrl: "https://cdn.example.com/peer.jpg",
        sourceSiteName: "Heritage Dental Centre",
        sourceSiteUrl: "https://heritagedentaledmonton.ca",
        sourcePageUrl: "https://heritagedentaledmonton.ca/edmonton-city-centre/",
        score: 3,
      },
      peerCsvFiles: [],
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/images/fetch-data-url")) {
          return {
            ok: false,
            json: async () => ({ error: "download failed" }),
          } as Response;
        }
        if (url.includes("/api/dataforseo") || url.includes("google") || url.includes("images")) {
          throw new Error(`Unexpected DFS/Google fetch: ${url}`);
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const { generateLocalInContentImageFromHtml } = await import(
      "@/lib/overview/overview-blog-local-image-generate"
    );

    await expect(
      generateLocalInContentImageFromHtml({
        html: htmlWithH2,
        site: {
          id: "bm",
          name: "Blind Magic",
          siteUrl: "https://blindmagic.com",
          username: "u",
          appPassword: "p",
        } as never,
        entity: "Edmonton City Centre",
        focusKeyword: "hunter douglas blinds edmonton city centre",
        forcedSectionHeader: "Overview",
        apiKey: "test-key",
        localImageMode: "generate",
        peerSites: [
          {
            id: "heritage",
            name: "Heritage Dental Centre",
            siteUrl: "https://heritagedentaledmonton.ca",
            username: "u",
            appPassword: "p",
            entitySitemapUrl: "https://heritagedentaledmonton.ca/sitemap.xml",
          } as never,
        ],
      }),
    ).rejects.toThrow(/Could not download shared Local Image/);

    expect(generateImage).not.toHaveBeenCalled();
    expect(fetchWikipediaPageLeadImage).not.toHaveBeenCalled();
  });
});
