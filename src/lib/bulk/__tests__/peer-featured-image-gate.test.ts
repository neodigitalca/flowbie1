import { describe, expect, it } from "vitest";
import { shouldPeerSearchFeaturedImage } from "@/lib/bulk/peer-featured-image-gate";

describe("shouldPeerSearchFeaturedImage", () => {
  it("skips peer search when Google Image is selected", () => {
    expect(
      shouldPeerSearchFeaturedImage({
        featuredImage: "google-maps",
        useGoogleMaps: true,
        useAiImagePath: false,
        hasPeerSites: true,
      }),
    ).toBe(false);
  });

  it("allows peer search for AI featured images", () => {
    expect(
      shouldPeerSearchFeaturedImage({
        featuredImage: "y",
        useGoogleMaps: false,
        useAiImagePath: true,
        hasPeerSites: true,
      }),
    ).toBe(true);
  });
});
