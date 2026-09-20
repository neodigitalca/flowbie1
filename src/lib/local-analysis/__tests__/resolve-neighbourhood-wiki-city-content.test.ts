import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GridLocationBucket } from "@/lib/local-analysis/grid-location-buckets";

const checkWikipediaPageExists = vi.fn();
const fetchWikipediaIntroPlainText = vi.fn();
const validateWikipediaPlacePage = vi.fn();
const isAcceptedWikiPlaceValidation = vi.fn();

vi.mock("@/lib/wikipedia/mediawiki-search", () => ({
  checkWikipediaPageExists: (...args: unknown[]) => checkWikipediaPageExists(...args),
}));

vi.mock("@/lib/wikipedia/mediawiki-intro", () => ({
  fetchWikipediaIntroPlainText: (...args: unknown[]) => fetchWikipediaIntroPlainText(...args),
}));

vi.mock("@/lib/wikipedia/validate-wikipedia-place-page-openrouter", () => ({
  validateWikipediaPlacePage: (...args: unknown[]) => validateWikipediaPlacePage(...args),
  isAcceptedWikiPlaceValidation: (...args: unknown[]) => isAcceptedWikiPlaceValidation(...args),
}));

vi.mock("@/lib/optimization-settings-storage", () => ({
  getResearchModel: () => "test-model",
}));

const naplesBucket: GridLocationBucket = {
  bucketId: "naples-fl",
  placeLabel: "Naples, FL",
  weight: 10,
  avgRank: 8,
  rowCount: 4,
  sampleAddresses: ["123 5th Ave S, Naples, FL 34102"],
};

function wikiExists(title: string) {
  return {
    exists: true,
    title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, "_"))}`,
  };
}

describe("resolveNeighbourhoodWikiOnly city content", () => {
  beforeEach(() => {
    checkWikipediaPageExists.mockReset();
    fetchWikipediaIntroPlainText.mockReset();
    validateWikipediaPlacePage.mockReset();
    isAcceptedWikiPlaceValidation.mockReset();
    checkWikipediaPageExists.mockImplementation(async (title: string) => {
      if (title === "Naples, Florida") return wikiExists("Naples, Florida");
      return { exists: false };
    });
  });

  it("stamps city wiki when the pick is Old Naples, Florida and the bucket is Naples, Florida", async () => {
    const fullNameBucket: GridLocationBucket = {
      ...naplesBucket,
      placeLabel: "Naples, Florida",
      sampleAddresses: ["Naples, Florida"],
    };
    const { resolveNeighbourhoodWikiOnly } = await import(
      "@/lib/local-analysis/entity-grid-location-wiki-agent"
    );
    const wiki = await resolveNeighbourhoodWikiOnly(
      "Old Naples, Florida",
      fullNameBucket,
      "test-key",
      undefined,
    );
    expect(wiki?.title).toBe("Naples, Florida");
  });

  it("keeps neighbourhood entity wiki stamp as the city article when the neighbourhood page is missing", async () => {
    const { resolveNeighbourhoodWikiOnly } = await import(
      "@/lib/local-analysis/entity-grid-location-wiki-agent"
    );
    const wiki = await resolveNeighbourhoodWikiOnly(
      "Old Naples, Naples, FL",
      naplesBucket,
      "test-key",
      undefined,
    );
    expect(wiki).not.toBeNull();
    expect(wiki?.title).toBe("Naples, Florida");
    expect(wiki?.url).toContain("Naples%2C_Florida");
    expect(wiki?.gridPlaceLabel).toBe("Naples, FL");
  });

  it("stamps city wiki for Park Shore, Port Royal, and Coquina Sands the same way", async () => {
    const { resolveNeighbourhoodWikiOnly } = await import(
      "@/lib/local-analysis/entity-grid-location-wiki-agent"
    );
    for (const entity of [
      "Park Shore, Naples, FL",
      "Port Royal, Naples, FL",
      "Coquina Sands, Naples, FL",
      "Aqualane Shores, Naples, FL",
    ]) {
      const wiki = await resolveNeighbourhoodWikiOnly(entity, naplesBucket, "test-key", undefined);
      expect(wiki?.title, entity).toBe("Naples, Florida");
    }
  });

  it("does not probe neighbourhood titles, including homonyms like Port Royal", async () => {
    const { resolveNeighbourhoodWikiOnly } = await import(
      "@/lib/local-analysis/entity-grid-location-wiki-agent"
    );
    const wiki = await resolveNeighbourhoodWikiOnly(
      "Port Royal, Naples, FL",
      naplesBucket,
      "test-key",
      undefined,
    );
    expect(wiki?.title).toBe("Naples, Florida");
    expect(checkWikipediaPageExists).not.toHaveBeenCalled();
  });
});
