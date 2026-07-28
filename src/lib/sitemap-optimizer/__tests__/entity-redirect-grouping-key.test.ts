import { describe, expect, it } from "vitest";
import {
  entityNeighborhoodFromPathTail,
  entityRedirectGroupingKey,
} from "@/lib/sitemap-optimizer/entity-redirect-grouping-key";

describe("entityRedirectGroupingKey", () => {
  it("uses city bucket for city-seo-neighborhood slugs", () => {
    expect(
      entityRedirectGroupingKey("https://neodigital.ca/service-area/edmonton-seo-griesbach-edmonton/"),
    ).toBe("edmonton");
    expect(entityNeighborhoodFromPathTail("edmonton-seo-griesbach-edmonton")).toBe("griesbach");
    expect(entityNeighborhoodFromPathTail("edmonton-seo-near-bulyea-heights-edmonton")).toBe(
      "bulyea-heights",
    );
  });

  it("uses leading place for blinds-style slugs", () => {
    expect(entityRedirectGroupingKey("https://example.com/service-area/stony-plain-blinds/")).toBe(
      "stony-plain",
    );
  });
});
