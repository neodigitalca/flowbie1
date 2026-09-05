import { describe, expect, it } from "vitest";
import { toSentenceCaseLinkAnchor } from "@/lib/content-generation/link-anchor-text-case";

describe("toSentenceCaseLinkAnchor", () => {
  it("lowercases generic product words from Title Case titles", () => {
    expect(toSentenceCaseLinkAnchor("Rechargeable Battery Wand")).toBe("rechargeable battery wand");
    expect(toSentenceCaseLinkAnchor("Solar Chargers")).toBe("solar chargers");
    expect(toSentenceCaseLinkAnchor("Battery Wand Repair")).toBe("battery wand repair");
    expect(toSentenceCaseLinkAnchor("Operating Systems")).toBe("operating systems");
  });

  it("preserves brand and product-line tokens", () => {
    expect(toSentenceCaseLinkAnchor("Hunter Douglas Rechargeable Battery Wand")).toBe(
      "Hunter Douglas rechargeable",
    );
    expect(toSentenceCaseLinkAnchor("PowerView Motorization")).toBe("PowerView motorization");
    expect(toSentenceCaseLinkAnchor("Blind Magic Rechargeable Battery Wands")).toBe(
      "Blind Magic rechargeable",
    );
  });

  it("respects maxWords", () => {
    expect(toSentenceCaseLinkAnchor("Rechargeable Battery Wand Features Explained", 4)).toBe(
      "rechargeable battery wand features",
    );
  });
});
