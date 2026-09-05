import { describe, expect, it } from "vitest";
import {
  buildContentOptimizePipelineTitles,
  buildPredeterminedBlogBodyHarnessTitles,
  CONTENT_OPTIMIZE_PIPELINE_TITLES,
  extractBodyHarnessTitlesFromSections,
  isContentOptimizePipelineTitles,
  resolveContentOptimizePipelineTitlesForRow,
  resolveContentOptimizePipelineTitlesFromHarness,
} from "@/lib/overview/overview-content-optimize-pipeline";

describe("overview-content-optimize-pipeline", () => {
  it("uses eight fixed slots without body harness titles", () => {
    expect(buildContentOptimizePipelineTitles()).toEqual([...CONTENT_OPTIMIZE_PIPELINE_TITLES]);
    expect(isContentOptimizePipelineTitles([...CONTENT_OPTIMIZE_PIPELINE_TITLES])).toBe(true);
    expect(CONTENT_OPTIMIZE_PIPELINE_TITLES).toContain("Link targets");
  });

  it("inserts dynamic body harness titles between link targets and content files", () => {
    const titles = buildContentOptimizePipelineTitles(["Overview", "Answer", "Motorization Compared"]);
    expect(titles[0]).toBe("Keyword research");
    expect(titles[1]).toBe("Selected keyword");
    expect(titles[2]).toBe("SERP research brief");
    expect(titles[4]).toBe("Blueprint");
    expect(titles[5]).toBe("Link targets");
    expect(titles.slice(6, 9)).toEqual(["Overview", "Answer", "Motorization Compared"]);
    expect(titles[titles.length - 2]).toBe("Content HTML");
    expect(titles[titles.length - 1]).toBe("Content Markdown");
    expect(isContentOptimizePipelineTitles(titles)).toBe(true);
  });

  it("extracts body titles between Link targets and Content HTML", () => {
    const sections = [
      { title: "Keyword research" },
      { title: "Selected keyword" },
      { title: "SERP research brief" },
      { title: "Checklist" },
      { title: "Blueprint" },
      { title: "Link targets" },
      { title: "Answer" },
      { title: "Overview" },
      { title: "Motorization Compared" },
      { title: "Content HTML" },
      { title: "Content Markdown" },
    ];
    expect(extractBodyHarnessTitlesFromSections(sections)).toEqual([
      "Answer",
      "Overview",
      "Motorization Compared",
    ]);
    expect(resolveContentOptimizePipelineTitlesFromHarness(sections)).toEqual([
      "Keyword research",
      "Selected keyword",
      "SERP research brief",
      "Checklist",
      "Blueprint",
      "Link targets",
      "Answer",
      "Overview",
      "Motorization Compared",
      "Content HTML",
      "Content Markdown",
    ]);
  });

  it("expands pipeline titles from blueprint row files when harness is still five slots", () => {
    const harness = [
      { title: "SERP research brief" },
      { title: "Checklist" },
      { title: "Blueprint" },
      { title: "Content HTML" },
      { title: "Content Markdown" },
    ];
    const rowFiles = [
      {
        name: "blueprint-smart-blinds.json",
        content: JSON.stringify({
          agents: [{ title: "Answer" }, { title: "Overview" }, { title: "Motorization Compared" }],
        }),
      },
    ];
    expect(resolveContentOptimizePipelineTitlesForRow(harness, rowFiles, "Smart Blinds")).toEqual([
      "Keyword research",
      "Selected keyword",
      "SERP research brief",
      "Checklist",
      "Blueprint",
      "Link targets",
      "Answer",
      "Overview",
      "Motorization Compared",
      "Content HTML",
      "Content Markdown",
    ]);
  });

  it("adds generic body placeholders when harness only has fixed optimize slots", () => {
    const harness = [...CONTENT_OPTIMIZE_PIPELINE_TITLES].map((title) => ({ title }));
    const titles = resolveContentOptimizePipelineTitlesForRow(harness, [], "Smart Blinds Automation");
    expect(titles.length).toBeGreaterThan(CONTENT_OPTIMIZE_PIPELINE_TITLES.length);
    expect(titles[0]).toBe("Keyword research");
    expect(titles).toContain("Section 1");
    expect(titles).not.toContain("How Smart Blinds Automation works");
    expect(titles[titles.length - 2]).toBe("Content HTML");
  });
});
