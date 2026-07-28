import { describe, expect, it } from "vitest";
import {
  buildGscTop10RagPayloadForSite,
  buildGscRagPromptInstructions,
  normalizeGscPositionForTokens,
} from "../vertical-benchmark-gsc-rag";
import type { GscTop10CsvRow } from "../vertical-benchmark-types";

const sampleRows: GscTop10CsvRow[] = [
  {
    site_id: "a1",
    site_name: "Alpha",
    site_url: "https://alpha.com",
    client_tag: "WT",
    content_kind: "post",
    rank: 1,
    url: "https://alpha.com/blog/winner",
    clicks: 50,
    impressions: 500,
    position: 3.2,
    gsc_start_date: "2026-01-01",
    gsc_end_date: "2026-03-01",
  },
  {
    site_id: "a1",
    site_name: "Alpha",
    site_url: "https://alpha.com",
    client_tag: "WT",
    content_kind: "entity",
    rank: 1,
    url: "https://alpha.com/edmonton",
    clicks: 10,
    impressions: 100,
    position: 5,
    gsc_start_date: "2026-01-01",
    gsc_end_date: "2026-03-01",
  },
];

describe("normalizeGscPositionForTokens", () => {
  it("ceil-rounds to integers (no decimal places in prompts)", () => {
    expect(normalizeGscPositionForTokens(3.2)).toBe(4);
    expect(normalizeGscPositionForTokens(3)).toBe(3);
    expect(normalizeGscPositionForTokens(3.01)).toBe(4);
  });
});

describe("buildGscTop10RagPayloadForSite", () => {
  it("keeps only post rows for the target site", () => {
    const payload = buildGscTop10RagPayloadForSite(
      "a1",
      "Alpha",
      "https://alpha.com",
      "Window Treatment",
      sampleRows,
      "post",
    );
    expect(payload.topPages).toHaveLength(1);
    expect(payload.topPages[0].url).toContain("/blog/");
    expect(payload.topPages[0].content_kind).toBe("post");
    expect(payload.topPages[0].position).toBe(4);
  });
});

describe("buildGscRagPromptInstructions", () => {
  it("marks GSC as in-memory RAG not a file", () => {
    expect(buildGscRagPromptInstructions()).toMatch(/IN MEMORY, NOT A FILE/i);
  });

  it("mentions service-area URLs for entity mode", () => {
    expect(buildGscRagPromptInstructions("entity")).toMatch(/service-area/i);
  });
});
