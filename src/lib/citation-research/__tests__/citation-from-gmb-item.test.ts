import { describe, expect, it } from "vitest";
import { buildGmbKeywordFromListingAndContext } from "../citation-from-gmb-item";

describe("buildGmbKeywordFromListingAndContext", () => {
  it("uses seed when title has no city/region line", () => {
    expect(
      buildGmbKeywordFromListingAndContext({
        listing: null,
        businessTitleFallback: "interiorsbylaura.com",
        cityRegionLine: "",
        seedKeyword: "Laura Interiors Austin TX",
      }),
    ).toBe("interiorsbylaura.com Laura Interiors Austin TX");
  });

  it("prefers city region over seed when both present", () => {
    expect(
      buildGmbKeywordFromListingAndContext({
        listing: null,
        businessTitleFallback: "Laura Interiors",
        cityRegionLine: "Austin, TX",
        seedKeyword: "extra",
      }),
    ).toBe("Laura Interiors Austin, TX");
  });
});
