import { describe, expect, it } from "vitest";
import { parseCsvStaticText } from "./bulk-csv-parser";

describe("chat log blog CSV template compatibility", () => {
  it("parses bulk template rows from chat gap export shape", () => {
    const csv = [
      "keyword,entity,title,modifier,featuredImage,publish_date_gmt,sitemap_type,meta_description,target_slug,wikipedia_url,wikipedia_title",
      'solar panel cost,,Solar Panel Costs And What To Expect,Customers asked about pricing during chat,y,2026-01-15T12:00:00.000Z,post,Learn what drives solar panel costs for homeowners.,,,',
      'window tint types,,Window Tint Types Compared,Multiple sessions asked about film options,y,2026-01-22T12:00:00.000Z,post,Compare window tint types and how to choose the right film.,,,',
    ].join("\n");

    const rows = parseCsvStaticText(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].keyword).toBe("solar panel cost");
    expect(rows[0].title).toBe("Solar Panel Costs And What To Expect");
    expect(rows[0].featuredImage).toBe("y");
    expect(rows[0].modifier).toContain("pricing");
  });
});
