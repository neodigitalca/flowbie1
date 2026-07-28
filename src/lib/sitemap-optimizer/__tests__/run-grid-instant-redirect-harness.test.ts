import { describe, expect, it } from "vitest";
import { runGridInstantRedirectHarness } from "@/lib/sitemap-optimizer/run-grid-instant-redirect-harness";
import type { GscParsedPageRow } from "@/lib/sitemap-optimizer/parse-gsc-pages-csv";
import type { SitemapOptimizerProgress } from "@/lib/sitemap-optimizer/types";

function uploadRow(oldUrl: string, newUrl: string, index: number): GscParsedPageRow {
  return {
    page: newUrl,
    redirectFromUrl: oldUrl,
    clicks: 0,
    impressions: 10,
    ctr: 0,
    position: 1,
    csvUploadRow: index,
  };
}

describe("runGridInstantRedirectHarness", () => {
  it("builds one cluster and redirect per row without AI phases", () => {
    const sharedDest = "https://www.example.com/blog/alberta-tax-brackets-2026/";
    const upload = [
      uploadRow("https://www.example.com/old-a/", sharedDest, 1),
      uploadRow("https://www.example.com/old-b/", sharedDest, 2),
      uploadRow(
        "https://www.example.com/old-c/",
        "https://www.example.com/blog/kwb-holiday-greeting/",
        3,
      ),
    ];
    const phases: SitemapOptimizerProgress["phase"][] = [];
    const ac = new AbortController();

    const res = runGridInstantRedirectHarness({
      gscPagesUpload: upload,
      dateRange: { startDate: "2026-05-01", endDate: "2026-05-29" },
      callbacks: {
        setPhase: (p) => phases.push(p),
        setProgress: () => {},
        signal: ac.signal,
      },
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.clusters.clusters).toHaveLength(2);
    expect(res.result.merges).toHaveLength(2);
    expect(res.result.contentSheet).toHaveLength(2);
    expect(res.result.rows).toHaveLength(3);
    expect(
      res.result.clusters.clusters.find((c) => c.memberPostIds.length === 2),
    ).toBeTruthy();
    expect(phases).toContain("ingest_csv");
    expect(phases[phases.length - 1]).toBe("done");
    expect(phases).not.toContain("merge");
    expect(phases).not.toContain("tagging");
  });
});
