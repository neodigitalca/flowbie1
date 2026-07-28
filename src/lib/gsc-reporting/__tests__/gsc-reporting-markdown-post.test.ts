import { describe, expect, it } from "vitest";
import {
  applyGscReportingMarkdownPost,
  capPipeTableDataRows,
  stripEmptyPipeTables,
  stripMarkdownHeadingsH3ThroughH6,
} from "@/lib/gsc-reporting/gsc-reporting-markdown-post";

describe("stripMarkdownHeadingsH3ThroughH6", () => {
  it("removes h3-h6 lines", () => {
    const md = "Intro\n\n### Key Insights\n\nMore";
    expect(stripMarkdownHeadingsH3ThroughH6(md)).toBe("Intro\n\n\nMore");
  });

  it("keeps h2", () => {
    const md = "## Stay\n\n### Go";
    const out = stripMarkdownHeadingsH3ThroughH6(md);
    expect(out).toContain("## Stay");
    expect(out).not.toContain("### Go");
  });
});

describe("stripEmptyPipeTables", () => {
  it("removes header-only tables", () => {
    const md = ["Before", "| A | B |", "| --- | --- |", "", "After"].join("\n");
    expect(stripEmptyPipeTables(md)).toBe(["Before", "", "After"].join("\n"));
  });

  it("keeps tables with data", () => {
    const md = ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n");
    expect(stripEmptyPipeTables(md)).toBe(md);
  });
});

describe("capPipeTableDataRows", () => {
  it("truncates to six data rows", () => {
    const rows = ["| A | B |", "| --- | --- |"];
    for (let k = 1; k <= 10; k++) rows.push(`| ${k} | ${k} |`);
    const md = rows.join("\n");
    const out = capPipeTableDataRows(md, 6);
    const dataLines = out.split("\n").filter((l) => /^\| \d/.test(l.trim()));
    expect(dataLines.length).toBe(6);
  });
});

describe("applyGscReportingMarkdownPost", () => {
  it("preserves ### for executive_summary", () => {
    const md = "### Key Insights\n\n- **A:** x";
    expect(applyGscReportingMarkdownPost(md, "executive_summary")).toContain("### Key Insights");
  });

  it("strips ### for key_performance_insights", () => {
    const md = "### Key Insights\n\nText";
    expect(applyGscReportingMarkdownPost(md, "key_performance_insights")).not.toContain("###");
  });
});
