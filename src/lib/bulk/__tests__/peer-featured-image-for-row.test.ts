import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";

vi.mock("@/lib/wordpress-api/connection", () => ({
  BACKEND_API_BASE: "",
}));

vi.mock("@/lib/overview/sap-peer-featured-image-search", () => ({
  searchPeerFeaturedImage: vi.fn(),
}));

vi.mock("@/lib/overview/overview-blog-local-image-generate", () => ({
  prepareLocalImageDataUrl: vi.fn(),
}));

const peerSite = { id: "peer", siteUrl: "https://peer.example.com" } as WordPressSite;
const targetSite = { id: "target", siteUrl: "https://target.example.com" } as WordPressSite;

const peerHit = {
  imageUrl: "https://peer.example.com/wp-content/uploads/featured.jpg",
  mediaId: 42,
  sourceSiteName: "Peer Site",
  sourceSiteUrl: "https://peer.example.com",
  sourcePageUrl: "https://peer.example.com/alberta-avenue-edmonton/",
  score: 3,
  matchedKeyword: "alberta avenue edmonton",
};

describe("findPeerFeaturedImageForRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the prepared peer image on a hit", async () => {
    const { searchPeerFeaturedImage } = await import(
      "@/lib/overview/sap-peer-featured-image-search"
    );
    const { prepareLocalImageDataUrl } = await import(
      "@/lib/overview/overview-blog-local-image-generate"
    );
    vi.mocked(searchPeerFeaturedImage).mockResolvedValue({ hit: peerHit, csvFile: null });
    vi.mocked(prepareLocalImageDataUrl).mockResolvedValue({
      dataUrl: "data:image/jpeg;base64,prepared",
      width: 1600,
      height: 900,
      upscaled: false,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ dataUrl: "data:image/jpeg;base64,raw" }),
      })) as unknown as typeof fetch,
    );

    const { findPeerFeaturedImageForRow } = await import(
      "@/lib/bulk/peer-featured-image-for-row"
    );
    const result = await findPeerFeaturedImageForRow({
      peerSites: [peerSite],
      targetSite,
      mode: "entity",
      matchKey: "Alberta Avenue Edmonton",
      apiKey: "test-key",
    });

    expect(result).not.toBeNull();
    expect(result!.dataUrl).toBe("data:image/jpeg;base64,prepared");
    expect(result!.fileName).toBe("alberta-avenue-edmonton-peer-featured.jpg");
    expect(result!.sourceSiteName).toBe("Peer Site");
    expect(result!.sourcePageUrl).toBe(peerHit.sourcePageUrl);
    // Mode and match key forwarded to the search.
    expect(vi.mocked(searchPeerFeaturedImage).mock.calls[0]![0]).toMatchObject({
      mode: "entity",
      placeEntity: "Alberta Avenue Edmonton",
      excludeSite: targetSite,
    });
  });

  it("uses keyword (not placeEntity) for blog mode", async () => {
    const { searchPeerFeaturedImage } = await import(
      "@/lib/overview/sap-peer-featured-image-search"
    );
    vi.mocked(searchPeerFeaturedImage).mockResolvedValue({ hit: null, csvFile: null });

    const { findPeerFeaturedImageForRow } = await import(
      "@/lib/bulk/peer-featured-image-for-row"
    );
    const result = await findPeerFeaturedImageForRow({
      peerSites: [peerSite],
      targetSite,
      mode: "blog",
      matchKey: "custom blinds edmonton",
    });

    expect(result).toBeNull();
    expect(vi.mocked(searchPeerFeaturedImage).mock.calls[0]![0]).toMatchObject({
      mode: "blog",
      keyword: "custom blinds edmonton",
      placeEntity: undefined,
    });
  });

  it("throws when a committed peer hit fails to download (no fallback)", async () => {
    const { searchPeerFeaturedImage } = await import(
      "@/lib/overview/sap-peer-featured-image-search"
    );
    vi.mocked(searchPeerFeaturedImage).mockResolvedValue({ hit: peerHit, csvFile: null });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 502,
        json: async () => ({ error: "Failed to download image (404)" }),
      })) as unknown as typeof fetch,
    );

    const { findPeerFeaturedImageForRow } = await import(
      "@/lib/bulk/peer-featured-image-for-row"
    );
    await expect(
      findPeerFeaturedImageForRow({
        peerSites: [peerSite],
        targetSite,
        mode: "entity",
        matchKey: "Alberta Avenue Edmonton",
      }),
    ).rejects.toThrow("Failed to download image (404)");
  });

  it("returns null without searching when there is no match key or no peers", async () => {
    const { searchPeerFeaturedImage } = await import(
      "@/lib/overview/sap-peer-featured-image-search"
    );

    const { findPeerFeaturedImageForRow } = await import(
      "@/lib/bulk/peer-featured-image-for-row"
    );
    expect(
      await findPeerFeaturedImageForRow({
        peerSites: [peerSite],
        targetSite,
        mode: "blog",
        matchKey: "  ",
      }),
    ).toBeNull();
    expect(
      await findPeerFeaturedImageForRow({
        peerSites: [],
        targetSite,
        mode: "blog",
        matchKey: "custom blinds",
      }),
    ).toBeNull();
    expect(vi.mocked(searchPeerFeaturedImage)).not.toHaveBeenCalled();
  });
});
