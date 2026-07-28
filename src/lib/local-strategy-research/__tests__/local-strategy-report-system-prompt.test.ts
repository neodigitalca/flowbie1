import { describe, expect, it } from "vitest";
import {
  getLocalStrategyReportSectionSystemPrompt,
  LOCAL_STRATEGY_REQUIRED_H2,
  LOCAL_STRATEGY_SECTION_COUNT,
  stitchLocalStrategyReportSections,
} from "@/lib/local-strategy-research/local-strategy-report-system-prompt";

describe("local-strategy-report-system-prompt", () => {
  it("has 13 sections", () => {
    expect(LOCAL_STRATEGY_SECTION_COUNT).toBe(13);
  });

  it("section 1 requires fixed H1 title (default 4 months)", () => {
    const sys = getLocalStrategyReportSectionSystemPrompt(1);
    expect(sys).toContain("# **Ascend & Expand: A 4-Month Local SEO Blueprint**");
    expect(sys).toContain("4-month scope");
    expect(sys).toContain("no ## headings yet");
  });

  it("section 1 planMonths overrides title and opening scope", () => {
    const sys = getLocalStrategyReportSectionSystemPrompt(1, 3);
    expect(sys).toContain("# **Ascend & Expand: A 3-Month Local SEO Blueprint**");
    expect(sys).toContain("3-month scope");
    expect(sys).toContain("ls.planMonths");
  });

  it("section 4 requires Content Audit table columns", () => {
    const sys = getLocalStrategyReportSectionSystemPrompt(4);
    expect(sys).toContain("## Content Audit");
    expect(sys).toContain("Audit Category");
    expect(sys).toContain("Relevant KB Page Example");
  });

  it("section 11 requires Site Speed Optimization", () => {
    const sys = getLocalStrategyReportSectionSystemPrompt(11);
    expect(sys).toContain("## Site Speed Optimization");
    expect(sys).toContain("perf");
  });

  it("section 12 requires FAQ Optimization", () => {
    const sys = getLocalStrategyReportSectionSystemPrompt(12);
    expect(sys).toContain("## FAQ Optimization");
    expect(sys).toContain("faq");
  });

  it("section 13 requires Task And Hours six categories", () => {
    const sys = getLocalStrategyReportSectionSystemPrompt(13);
    expect(sys).toContain("## Task And Hours");
    expect(sys).toContain("Content Audit");
    expect(sys).toContain("Local Profile Management");
    expect(sys).toContain("Technical SEO & Schema");
  });

  it("required H2 list has 12 items", () => {
    expect(LOCAL_STRATEGY_REQUIRED_H2.length).toBe(12);
    expect(LOCAL_STRATEGY_REQUIRED_H2).toContain("Site Speed Optimization");
    expect(LOCAL_STRATEGY_REQUIRED_H2).toContain("FAQ Optimization");
    expect(LOCAL_STRATEGY_REQUIRED_H2[LOCAL_STRATEGY_REQUIRED_H2.length - 1]).toBe("Task And Hours");
  });

  it("stitch joins sections with double newline", () => {
    const out = stitchLocalStrategyReportSections(["a", "b", "c"]);
    expect(out).toBe("a\n\nb\n\nc");
  });
});
