import { describe, expect, it, vi } from "vitest";
import {
  canUseLocalInContentImage,
  normalizeGoogleImagesSerpItems,
  resolveLocalImagePlaceEntity,
} from "@/lib/overview/overview-local-image-dfs-normalize";
import {
  assertPlaceMatchOrThrow,
  assertImageQualityOrThrow,
  capGoogleImagesCandidates,
  LOCAL_IMAGE_CANDIDATE_LIMIT,
  LOCAL_IMAGE_QUALITY_MIN,
  parseLocalImagePlacePick,
} from "@/lib/overview/overview-blog-local-image-generate";
import { formatSapPeerLibraryCsv } from "@/lib/overview/sap-cross-site-image-search";

vi.mock("@/lib/content-optimization/entity", () => ({
  extractGeographicEntityWithAI: vi.fn(async () => "Stadium Station Edmonton"),
}));

describe("normalizeGoogleImagesSerpItems", () => {
  it("extracts images_search items from DFS tasks payload", () => {
    const items = normalizeGoogleImagesSerpItems({
      tasks: [
        {
          result: [
            {
              items: [
                {
                  type: "images_search",
                  title: "Oliver Edmonton",
                  alt: "neighborhood",
                  url: "https://example.com/page",
                  source_url: "https://cdn.example.com/oliver.jpg",
                  encoded_url: "https://google.cache/oliver.jpg",
                  rank_absolute: 1,
                },
                { type: "related_searches", items: ["x"] },
                {
                  type: "images_search",
                  title: "Dup",
                  source_url: "https://cdn.example.com/oliver.jpg",
                  rank_absolute: 2,
                },
              ],
            },
          ],
        },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.image_url).toBe("https://cdn.example.com/oliver.jpg");
    expect(items[0]?.source_url).toBe("https://example.com/page");
    expect(items[0]?.title).toBe("Oliver Edmonton");
  });
});

describe("canUseLocalInContentImage", () => {
  it("is true only for sap", () => {
    expect(canUseLocalInContentImage("sap")).toBe(true);
    expect(canUseLocalInContentImage("posts")).toBe(false);
    expect(canUseLocalInContentImage("pages")).toBe(false);
    expect(canUseLocalInContentImage(undefined)).toBe(false);
  });
});

describe("resolveLocalImagePlaceEntity", () => {
  it("returns place from geographic extractor (never focus keyword)", async () => {
    const place = await resolveLocalImagePlaceEntity({
      url: "https://blindmagic.com/service-area/hunter-douglas-blinds-stadium-station-edmonton/",
      title: "Best hunter douglas blinds Near Stadium Station (Edmonton)",
    });
    expect(place).toBe("Stadium Station Edmonton");
  });
});

describe("capGoogleImagesCandidates", () => {
  it("keeps at most LOCAL_IMAGE_CANDIDATE_LIMIT items", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      title: `t${i}`,
      source_url: `https://example.com/${i}`,
      image_url: `https://cdn.example.com/${i}.jpg`,
      alt: `a${i}`,
      rank: i + 1,
    }));
    const capped = capGoogleImagesCandidates(many);
    expect(LOCAL_IMAGE_CANDIDATE_LIMIT).toBe(10);
    expect(capped).toHaveLength(10);
    expect(capped[0]?.image_url).toBe("https://cdn.example.com/0.jpg");
    expect(capped[9]?.image_url).toBe("https://cdn.example.com/9.jpg");
    expect(capGoogleImagesCandidates(many.slice(0, 3))).toHaveLength(3);
  });
});

describe("parseLocalImagePlacePick / assertPlaceMatchOrThrow", () => {
  it("parses pick and rejects low confidence", () => {
    const pick = parseLocalImagePlacePick({
      chosenIndex: 1,
      why: "skyline matches",
      placeMatchConfidence: 0.9,
      qualityScore: 0.8,
      visualDescription: "Tall glass towers over a park",
    });
    expect(pick.chosenIndex).toBe(1);
    expect(pick.qualityScore).toBe(0.8);
    expect(() => assertPlaceMatchOrThrow(pick)).not.toThrow();
    expect(() => assertImageQualityOrThrow(pick)).not.toThrow();

    const weak = parseLocalImagePlacePick({
      chosenIndex: 0,
      why: "unsure",
      placeMatchConfidence: 0.2,
      qualityScore: 0.9,
      visualDescription: "generic building",
    });
    expect(() => assertPlaceMatchOrThrow(weak)).toThrow(/confidently depicts/i);
  });

  it("rejects only when the place is not recognizable", () => {
    const soft = parseLocalImagePlacePick({
      chosenIndex: 0,
      why: "matches place",
      placeMatchConfidence: 0.9,
      qualityScore: 0.35,
      visualDescription: "Soft street view of the plaza",
    });
    expect(() => assertPlaceMatchOrThrow(soft)).not.toThrow();
    expect(() => assertImageQualityOrThrow(soft)).not.toThrow();

    const mush = parseLocalImagePlacePick({
      chosenIndex: 0,
      why: "matches place",
      placeMatchConfidence: 0.9,
      qualityScore: 0.1,
      visualDescription: "Unreadable blob",
    });
    expect(() => assertImageQualityOrThrow(mush)).toThrow(/not recognizable/i);
    expect(LOCAL_IMAGE_QUALITY_MIN).toBe(0.25);
  });

  it("defaults qualityScore when omitted but place match is strong", () => {
    const pick = parseLocalImagePlacePick({
      chosenIndex: 0,
      why: "match",
      placeMatchConfidence: 0.9,
      visualDescription: "Station platform with wood ceiling",
    });
    expect(pick.qualityScore).toBe(0.7);
  });

  it("normalizes 0-10 confidence scale to 0-1", () => {
    const pick = parseLocalImagePlacePick({
      chosenIndex: 0,
      why: "match",
      placeMatchConfidence: 5,
      qualityScore: 8,
      visualDescription: "Station platform with wood ceiling",
    });
    expect(pick.placeMatchConfidence).toBe(0.5);
    expect(pick.qualityScore).toBe(0.8);
  });
});

describe("recoverLocalImagePickFromPartialText", () => {
  it("recovers chosenIndex from truncated JSON", async () => {
    const { recoverLocalImagePickFromPartialText } = await import(
      "@/lib/overview/overview-blog-local-image-generate"
    );
    const pick = recoverLocalImagePickFromPartialText(
      `{\n  "chosenIndex": 4,\n  "why": "clear wide shot of the bridge",\n  "placeMatchConfidence": 1`,
    );
    expect(pick?.chosenIndex).toBe(4);
    expect(pick?.placeMatchConfidence).toBe(1);
  });
});

describe("pickEarlyLocalImageSectionHeader", () => {
  it("picks the first strong H2 after Overview", async () => {
    const { pickEarlyLocalImageSectionHeader } = await import(
      "@/lib/overview/overview-blog-local-image-generate"
    );
    const header = pickEarlyLocalImageSectionHeader([
      { header: "Book a Consultation:" },
      { header: "Overview" },
      { header: "Expert Family Dental Care Near Avonmore" },
      { header: "Our Commitment to the Avonmore Community" },
    ]);
    expect(header).toBe("Expert Family Dental Care Near Avonmore");
  });
});

describe("buildLocalImageCommunityAcceptanceBrief", () => {
  it("prefers community views without blacklisting houses", async () => {
    const { buildLocalImageCommunityAcceptanceBrief, buildLocalImageGoogleForcedTargets } =
      await import("@/lib/overview/overview-blog-local-image-generate");
    const brief = buildLocalImageCommunityAcceptanceBrief("Aldergrove, Edmonton");
    expect(brief).toContain("Aldergrove, Edmonton");
    expect(brief.toLowerCase()).toContain("community-scale");
    expect(brief.toLowerCase()).toContain("do not reject houses");
    expect(brief.toLowerCase()).toContain("weak match");

    const targets = buildLocalImageGoogleForcedTargets("Aldergrove, Edmonton");
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      kind: "place",
      query: "Aldergrove, Edmonton",
      role: "primary place",
    });
    expect(targets[0]?.acceptanceBrief).toBe(brief);
  });
});

describe("formatLocalImageChecklistMarkdown", () => {
  it("includes reference link, wiki preference, and no-embellish rules", async () => {
    const { formatLocalImageChecklistMarkdown } = await import(
      "@/lib/overview/overview-blog-in-content-image-harness-sections"
    );
    const md = formatLocalImageChecklistMarkdown({
      entity: "Stadium Station Edmonton",
      referenceImageUrl: "https://cdn.example.com/station.jpg",
      referenceSourceUrl: "https://example.com/article-about-station",
    });
    expect(md).toContain("Stadium Station Edmonton");
    expect(md).toContain("https://cdn.example.com/station.jpg");
    expect(md).toContain("https://example.com/article-about-station");
    expect(md.toLowerCase()).toContain("wikipedia");
    expect(md.toLowerCase()).toContain("community-scale");
    expect(md.toLowerCase()).toContain("embellish");
    expect(md.toLowerCase()).toContain("do not alter");
  });
});

describe("formatPeerLocalImageLibraryChecklistMarkdown", () => {
  it("summarizes peer CSV count and reuse without listing filenames", async () => {
    const { formatPeerLocalImageLibraryChecklistMarkdown } = await import(
      "@/lib/overview/overview-blog-in-content-image-harness-sections"
    );
    const md = formatPeerLocalImageLibraryChecklistMarkdown({
      entity: "Edmonton City Centre",
      peerFileNames: [
        "peer-local-images-heritage-dental.csv",
        "peer-local-images-phoenix-painting.csv",
      ],
      reusedFrom: "Heritage Dental",
    });
    expect(md).toContain("Edmonton City Centre");
    expect(md).toContain("Heritage Dental");
    expect(md).toContain("Peer CSV libraries: 2");
    expect(md).toContain("peer-local-images.csv");
    expect(md).not.toContain("peer-local-images-heritage-dental.csv");
  });
});

describe("appendLocalImagePhaseLog / formatLocalImagePhaseLine", () => {
  it("builds a Looking → Found → Generating log", async () => {
    const {
      appendLocalImagePhaseLog,
      formatLocalImagePhaseLine,
    } = await import("@/lib/overview/overview-blog-in-content-image-harness-sections");
    expect(formatLocalImagePhaseLine({ phase: "looking" })).toBe("Looking for image");
    let log = "";
    log = appendLocalImagePhaseLog(log, {
      phase: "looking",
      detail: "Looking for image on city peers",
    });
    log = appendLocalImagePhaseLog(log, {
      phase: "found",
      detail: "Found on Heritage Dental Centre",
    });
    log = appendLocalImagePhaseLog(log, {
      phase: "generating",
      detail: "Generating image",
    });
    expect(log).toBe(
      [
        "Looking for image on city peers",
        "Found on Heritage Dental Centre",
        "Generating image",
      ].join("\n"),
    );
  });
});

describe("formatSapPeerLibraryCsv", () => {
  it("emits header and inventory rows", () => {
    const csv = formatSapPeerLibraryCsv(
      { name: "Heritage Dental", siteUrl: "https://heritagedentaledmonton.ca" },
      [
        {
          siteId: "h",
          siteName: "Heritage Dental",
          siteUrl: "https://heritagedentaledmonton.ca",
          collection: "service-area",
          pageUrl: "https://heritagedentaledmonton.ca/edmonton-city-centre/",
          id: 1,
          title: "Edmonton City Centre",
          slug: "edmonton-city-centre",
          keyword: "blinds",
          imageUrl: "https://cdn.example.com/x.jpg",
        },
      ],
    );
    expect(csv.split("\n")[0]).toBe("site,title,pageUrl,slug,keyword,imageUrl");
    expect(csv).toContain("Heritage Dental");
    expect(csv).toContain("https://cdn.example.com/x.jpg");
  });

  it("appends multiple peer libraries into one CSV", async () => {
    const { formatCombinedSapPeerLibraryCsv } = await import(
      "@/lib/overview/sap-cross-site-image-search"
    );
    const csv = formatCombinedSapPeerLibraryCsv([
      {
        site: { name: "Heritage Dental", siteUrl: "https://h.example" },
        entries: [
          {
            siteId: "h",
            siteName: "Heritage Dental",
            siteUrl: "https://h.example",
            collection: "service-area",
            pageUrl: "https://h.example/a/",
            id: 1,
            title: "A",
            slug: "a",
            keyword: "",
          },
        ],
      },
      {
        site: { name: "Phoenix", siteUrl: "https://p.example" },
        entries: [
          {
            siteId: "p",
            siteName: "Phoenix",
            siteUrl: "https://p.example",
            collection: "service-area",
            pageUrl: "https://p.example/b/",
            id: 2,
            title: "B",
            slug: "b",
            keyword: "",
          },
        ],
      },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("site,title,pageUrl,slug,keyword,imageUrl");
    expect(lines).toHaveLength(3);
    expect(csv).toContain("Heritage Dental");
    expect(csv).toContain("Phoenix");
  });
});
