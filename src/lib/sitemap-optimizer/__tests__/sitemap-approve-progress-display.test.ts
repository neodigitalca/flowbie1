import { describe, expect, it } from "vitest";
import {
  sitemapApproveOverallPct,
  sitemapApproveStepStatus,
} from "@/lib/sitemap-optimizer/sitemap-approve-progress-display";

describe("sitemap-approve-progress-display", () => {
  it("increases overall pct through approve phases", () => {
    const redirects = sitemapApproveOverallPct({
      phase: "redirects",
      completed: 0,
      total: 1,
    });
    const trash = sitemapApproveOverallPct({
      phase: "trash",
      completed: 1,
      total: 4,
    });
    const done = sitemapApproveOverallPct({
      phase: "done",
      completed: 4,
      total: 4,
    });

    expect(redirects).toBeGreaterThan(0);
    expect(trash).toBeGreaterThan(redirects);
    expect(done).toBe(100);
  });

  it("marks earlier steps done when trash is active", () => {
    const progress = {
      phase: "trash" as const,
      completed: 1,
      total: 4,
    };
    expect(sitemapApproveStepStatus("redirects", progress)).toBe("done");
    expect(sitemapApproveStepStatus("content_sheet", progress)).toBe("done");
    expect(sitemapApproveStepStatus("trash", progress)).toBe("active");
    expect(sitemapApproveStepStatus("done", progress)).toBe("pending");
  });
});
