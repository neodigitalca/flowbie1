import { describe, expect, it } from "vitest";
import {
  buildAllowlistPathnameSet,
  buildSapEntityAllowlistChunkText,
  buildSapEntityGrounding,
  buildSapFilteredPagesEvidence,
  buildSapFilteredPagesChunkText,
  isPagesMomReportingFile,
  pathnameKeyFromUrl,
  siteOriginFromPublicUrl,
} from "@/lib/gsc-reporting/gsc-reporting-sap-entity-context";

const SAMPLE_PAGES_MOM = [
  "# Pages: MoM (one row per URL; Search Analytics totals per period).",
  "#",
  "Page,Clicks (Apr 2026),Clicks (Mar 2026),Clicks Δ%,Impressions (Apr 2026),Impressions (Mar 2026),Impr Δ%,CTR (Apr 2026),CTR (Mar 2026),CTR Δ%,Position (Apr 2026),Position (Mar 2026),Pos Δ%",
  "https://example.com/service-area/downtown-atlanta/,3,2,+50%,400,300,+33%,1.00%,2.00%,-50%,8.00,10.00,+25%",
  "https://example.com/,66,70,-5%,5206,5000,+4%,1.00%,1.20%,-15%,22.00,24.00,+8%",
  "https://example.com/retail-store/wall-coverings/,26,30,-13%,3306,3000,+10%,0.80%,1.00%,-20%,12.00,13.00,+7%",
].join("\n");

describe("pathnameKeyFromUrl", () => {
  it("normalizes trailing slash", () => {
    expect(pathnameKeyFromUrl("https://example.com/foo/")).toBe("/foo");
    expect(pathnameKeyFromUrl("https://example.com/foo")).toBe("/foo");
  });

  it("returns null for invalid input", () => {
    expect(pathnameKeyFromUrl("")).toBeNull();
    expect(pathnameKeyFromUrl("not-a-url")).toBeNull();
  });
});

describe("buildAllowlistPathnameSet", () => {
  it("stores pathname keys", () => {
    const s = buildAllowlistPathnameSet([
      "https://example.com/service-area/downtown-atlanta/",
      "https://example.com/other/",
    ]);
    expect(s.has("/service-area/downtown-atlanta")).toBe(true);
    expect(s.has("/other")).toBe(true);
  });
});

describe("isPagesMomReportingFile", () => {
  it("matches bundle filename and comment body", () => {
    expect(isPagesMomReportingFile("Pages-MoM.csv")).toBe(true);
    expect(isPagesMomReportingFile("foo.csv", "# Pages: MoM\n")).toBe(true);
    expect(isPagesMomReportingFile("Queries-MoM.csv")).toBe(false);
  });
});

describe("buildSapFilteredPagesEvidence", () => {
  it("keeps only rows whose Page pathname is in the entity allowlist", () => {
    const ev = buildSapFilteredPagesEvidence({
      files: [{ name: "Pages-MoM.csv", content: SAMPLE_PAGES_MOM }],
      allowlistUrls: ["https://example.com/service-area/downtown-atlanta/"],
      maxChars: 50_000,
    });
    expect(ev).toContain("service-area/downtown-atlanta");
    expect(ev).not.toContain("retail-store");
    expect(ev).not.toContain("https://example.com/,66");
  });

  it("returns empty when allowlist has no path keys", () => {
    const ev = buildSapFilteredPagesEvidence({
      files: [{ name: "Pages-MoM.csv", content: SAMPLE_PAGES_MOM }],
      allowlistUrls: [],
    });
    expect(ev).toBe("");
  });
});

describe("buildSapEntityGrounding + chunk text", () => {
  it("allowlist chunk explains zero URLs", () => {
    const g = buildSapEntityGrounding({
      files: [],
      allowlistUrls: [],
      sourceLabel: "Entity sitemap (service-area-sitemap.xml)",
      publicSiteUrl: "https://example.com",
    });
    const t = buildSapEntityAllowlistChunkText(g);
    expect(t).toMatch(/ENTITY_SITEMAP_ALLOWLIST/);
    expect(t).toMatch(/NO resolved entity/);
  });

  it("filtered-pages chunk falls back when evidence empty", () => {
    const g = buildSapEntityGrounding({
      files: [],
      allowlistUrls: ["https://example.com/a"],
      sourceLabel: "test",
      publicSiteUrl: "https://example.com",
    });
    const t = buildSapFilteredPagesChunkText(g);
    expect(t).toMatch(/FILTERED_PAGES_FOR_SAP/);
    expect(t).toMatch(/No Pages-MoM/);
  });
});

describe("siteOriginFromPublicUrl", () => {
  it("parses origin", () => {
    expect(siteOriginFromPublicUrl("https://www.example.com/path")).toBe("https://www.example.com");
  });
});
