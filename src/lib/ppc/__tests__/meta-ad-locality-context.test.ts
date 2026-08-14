import { describe, expect, it } from "vitest";
import {
  buildMetaCitySceneQuery,
  extractCityFromLooseText,
  resolveMetaAdLocalityContext,
} from "@/lib/ppc/meta-ad-locality-context";

describe("meta-ad-locality-context", () => {
  it("extracts Edmonton from AI SEO keyword", () => {
    expect(extractCityFromLooseText("AI SEO Edmonton")).toBe("Edmonton");
  });

  it("extracts city from in-phrase headline", () => {
    expect(extractCityFromLooseText("Rank Higher in Edmonton")).toBe("Edmonton");
  });

  it("parses comma-separated city region", () => {
    expect(extractCityFromLooseText("Edmonton, AB")).toBe("Edmonton");
  });

  it("resolves locality from focus keyword", () => {
    const ctx = resolveMetaAdLocalityContext({
      focusKeyword: "AI SEO Edmonton",
      adName: "Edmonton SEO",
    });
    expect(ctx.hasLocality).toBe(true);
    expect(ctx.city).toBe("Edmonton");
  });

  it("builds city scene query", () => {
    expect(buildMetaCitySceneQuery("Edmonton")).toBe("Edmonton skyline cityscape");
  });
});
