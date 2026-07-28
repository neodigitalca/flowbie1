import { describe, expect, it } from "vitest";
import {
  formatBlogHeadersGscHarnessMarkdown,
  rankBlogHeadersGscQueries,
} from "@/lib/overview/overview-blog-headers-gsc";

describe("overview-blog-headers-gsc", () => {
  it("ranks by clicks impressions and ctr", () => {
    const picks = rankBlogHeadersGscQueries([
      { query: "low", clicks: 1, impressions: 100, ctr: 0.01, position: 5 },
      { query: "high clicks", clicks: 50, impressions: 200, ctr: 0.25, position: 2 },
      { query: "high impr", clicks: 2, impressions: 5000, ctr: 0.0004, position: 8 },
    ]);
    expect(picks.byClicks[0]?.query).toBe("high clicks");
    expect(picks.byImpressions[0]?.query).toBe("high impr");
    expect(picks.headingKeywords[0]).toBe("high clicks");
    const md = formatBlogHeadersGscHarnessMarkdown(picks);
    expect(md).toContain("TOP BY CLICKS");
    expect(md).toContain("HEADING KEYWORD PRIORITY");
  });
});
