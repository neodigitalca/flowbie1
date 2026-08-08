import { describe, expect, it } from "vitest";
import { formatGscPageQueriesForLlm } from "@/lib/gsc-query-processor";

describe("formatGscPageQueriesForLlm", () => {
  it("sorts by clicks then impressions and strips stats from body", () => {
    const out = formatGscPageQueriesForLlm(
      [
        { query: "low", clicks: 1, impressions: 500 },
        { query: "high", clicks: 50, impressions: 10 },
        { query: "mid", clicks: 50, impressions: 200 },
      ],
      "https://example.com/page/",
    );

    expect(out).toContain("GSC keywords for https://example.com/page/");
    expect(out).toContain("clicks descending");
    expect(out.indexOf("1. mid")).toBeGreaterThan(-1);
    expect(out.indexOf("2. high")).toBeGreaterThan(out.indexOf("1. mid"));
    expect(out.indexOf("3. low")).toBeGreaterThan(out.indexOf("2. high"));
    const numberedLines = out.split("\n").filter((line) => /^\d+\./.test(line));
    for (const line of numberedLines) {
      expect(line).not.toMatch(/impressions|position/i);
    }
  });
});
