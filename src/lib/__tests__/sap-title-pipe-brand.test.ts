import { describe, expect, it } from "vitest";
import { sanitizeSapPageTitle, stripTitlePipeSuffix } from "@/lib/sap-title-pipe-brand";

describe("sap-title-pipe-brand", () => {
  it("strips any pipe suffix including hallucinated brand names", () => {
    expect(
      stripTitlePipeSuffix(
        "Kitchen Cabinet Refinishing In Decoteau, Edmonton | Phoenix Finishing Touch Painting",
      ),
    ).toBe("Kitchen Cabinet Refinishing In Decoteau, Edmonton");
  });

  it("sanitize removes pipe suffix then exact brand match", () => {
    expect(
      sanitizeSapPageTitle("Deck Painting in Albany | Phoenix Painting", "Phoenix Painting"),
    ).toBe("Deck Painting in Albany");
  });
});
