import { describe, expect, it } from "vitest";
import { parseLegacyUrlCsv } from "@/lib/redirect-matcher/parse-legacy-url-csv";

const site = {
  id: "site-1",
  name: "Test Site",
  siteUrl: "https://example.com",
  username: "u",
  appPassword: "p",
} as const;

describe("parseLegacyUrlCsv", () => {
  it("parses GSC Top pages export", () => {
    const csv = [
      "Top pages,Clicks,Impressions,CTR,Position",
      "https://example.com/2020/03/old-post/,120,4500,2.67%,8.2",
      "https://example.com/legacy-guide/,50,1000,5%,12",
    ].join("\n");

    const result = parseLegacyUrlCsv(csv, site as any);
    expect(result.error).toBeUndefined();
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.legacyUrl).toBe("https://example.com/2020/03/old-post/");
    expect(result.rows[0]?.clicks).toBe(120);
    expect(result.rows[0]?.impressions).toBe(4500);
  });

  it("parses redirect map old_url column", () => {
    const csv = [
      "old_url,new_url",
      "https://example.com/date/slug-a/,https://example.com/blog/slug-a/",
      "https://example.com/date/slug-b/,https://example.com/blog/slug-b/",
    ].join("\n");

    const result = parseLegacyUrlCsv(csv, site as any);
    expect(result.error).toBeUndefined();
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.legacyUrl).toBe("https://example.com/date/slug-a/");
  });

  it("parses bare single-column URL list", () => {
    const csv = [
      "https://example.com/a/",
      "https://example.com/b/",
    ].join("\n");

    const result = parseLegacyUrlCsv(csv, site as any);
    expect(result.error).toBeUndefined();
    expect(result.rows).toHaveLength(2);
  });

  it("accepts URLs on any domain", () => {
    const csv = "Top pages\nhttps://other.com/page/\n";
    const result = parseLegacyUrlCsv(csv, site as any);
    expect(result.error).toBeUndefined();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.legacyUrl).toBe("https://other.com/page/");
  });

  it("dedupes identical URLs", () => {
    const csv = [
      "Top pages",
      "https://example.com/same/",
      "https://example.com/same/",
    ].join("\n");

    const result = parseLegacyUrlCsv(csv, site as any);
    expect(result.rows).toHaveLength(1);
  });
});
