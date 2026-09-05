import { describe, expect, it } from "vitest";
import {
  bundleGscOutlineFilesForPrompt,
  selectGscOutlineSourceFiles,
} from "@/lib/gsc-reporting/gsc-reporting-outline-bundle";

describe("gsc-reporting-outline-bundle", () => {
  it("drops indexed page URL inventories from outline input", () => {
    const files = [
      { name: "Site-totals-MoM.csv", content: "Period,Clicks\nAug,1" },
      { name: "Indexed-pages-urls-current.csv", content: "url\nhttps://example.com/a\n".repeat(500) },
      { name: "Indexed-pages-urls-period-b.csv", content: "url\nhttps://example.com/b\n".repeat(500) },
    ];
    const selected = selectGscOutlineSourceFiles(files);
    expect(selected.map((f) => f.name)).toEqual(["Site-totals-MoM.csv"]);
  });

  it("caps Queries-MoM rows for outline prompt", () => {
    const rows = ["query,clicks", ...Array.from({ length: 200 }, (_, i) => `q${i},${i}`)].join("\n");
    const selected = selectGscOutlineSourceFiles([{ name: "Queries-MoM.csv", content: rows }]);
    expect(selected[0]?.content.split("\n").length).toBeLessThanOrEqual(122);
    expect(selected[0]?.content).toContain("omitted from outline prompt");
  });

  it("bundleGscOutlineFilesForPrompt stays under outline cap", () => {
    const huge = "x".repeat(120_000);
    const bundled = bundleGscOutlineFilesForPrompt([
      { name: "Site-totals-MoM.csv", content: "Period,Clicks\nAug,1" },
      { name: "Queries-MoM.csv", content: huge },
    ]);
    expect(bundled.text.length).toBeLessThanOrEqual(96_000);
  });
});
