import { describe, expect, it } from "vitest";
import {
  buildMergeGroupNumberByDestinationUrl,
  normalizeGridDestinationKey,
} from "@/lib/sitemap-optimizer/grid-merge-group-ids";

describe("grid-merge-group-ids", () => {
  it("normalizes destination URLs for grouping", () => {
    expect(normalizeGridDestinationKey("https://Example.com/path")).toBe(
      "https://example.com/path/",
    );
  });

  it("assigns one group id per destination with size-based ordering", () => {
    const counts = new Map([
      ["https://x.com/solo/", 1],
      ["https://x.com/pair/", 2],
      ["https://x.com/triple/", 3],
      ["https://x.com/big/", 5],
    ]);
    const map = buildMergeGroupNumberByDestinationUrl(counts);
    expect(map.get("https://x.com/triple/")).toBe(1);
    expect(map.get("https://x.com/big/")).toBe(2);
    expect(map.get("https://x.com/pair/")).toBe(3);
    expect(map.get("https://x.com/solo/")).toBe(4);
  });
});
