import { describe, expect, it } from "vitest";
import {
  getCompetitorReportMarkdownSystemPrompt,
  getCompetitorReportMarkdownUserInstructions,
  getCompetitorReportSectionSystemPrompt,
  stitchCompetitorReportSections,
} from "@/lib/competitor-research/competitor-report-system-prompt";

describe("competitor-report-system-prompt", () => {
  it("instructs net-new Anchor Demand vs gq and sk", () => {
    const sys = getCompetitorReportMarkdownSystemPrompt(20);
    expect(sys).toMatch(/net-new/i);
    expect(sys).toMatch(/gq/);
    expect(sys).toMatch(/\bsk\b/);
  });

  it("compact user instructions mention net-new and gq plus sk", () => {
    const u = getCompetitorReportMarkdownUserInstructions(20);
    expect(u).toMatch(/net-new/i);
    expect(u).toMatch(/gq plus sk/);
  });

  it("uses dfs research pipeline wording when dataSource is dfs", () => {
    const sys = getCompetitorReportMarkdownSystemPrompt(20, { dataSource: "dfs" });
    expect(sys).toMatch(/dfs pipeline|dfs research/i);
    expect(sys).toMatch(/KEYWORD STYLE/i);
  });

  it("expects three sections, Foundational Pillars as H2, Key insights subsection, Pain Points, and Traffic matrix", () => {
    const sys = getCompetitorReportMarkdownSystemPrompt(20);
    expect(sys).toMatch(/exactly three sections/i);
    expect(sys).toMatch(/## The Foundational Pillars/i);
    expect(sys).toMatch(/### Key insights/i);
    expect(sys).toMatch(/\*\*bold\*\*/i);
    expect(sys).toMatch(/Pain Points/i);
    expect(sys).toMatch(/Traffic & Intent Gaps/i);
    expect(sys).toMatch(/End after section 3/i);
    expect(sys).toMatch(/The Snapshot/);
    expect(sys).toMatch(/Four Moves That Win/);
    expect(sys).toMatch(/only a header row/i);
    expect(sys).not.toMatch(/Estimated Traffic Potential scenario table/i);
    expect(sys).not.toMatch(/Conservative, Moderate, and Aggressive/);
  });

  it("section 2 system prompt is single-section scoped (Pain Points; no one-shot full document)", () => {
    const sys = getCompetitorReportSectionSystemPrompt(2, 20);
    expect(sys).toMatch(/pass 2 of 3/i);
    expect(sys).toMatch(/## Pain Points/i);
    expect(sys).not.toMatch(/exactly three sections in the order below/i);
  });

  it("section 3 system prompt is Traffic & Intent Gaps (pass 3 of 3)", () => {
    const sys = getCompetitorReportSectionSystemPrompt(3, 20);
    expect(sys).toMatch(/pass 3 of 3/i);
    expect(sys).toMatch(/## Traffic & Intent Gaps/i);
  });

  it("shared scope describes seed demand proxies when gqDemandSource is dfs_seed", () => {
    const sys = getCompetitorReportSectionSystemPrompt(1, 20, { gqDemandSource: "dfs_seed" });
    expect(sys).toMatch(/not Google Search Console/i);
    expect(sys).toMatch(/ranked-keyword demand proxies/i);
  });

  it("planMonths overrides strategist shared scope for SCOPE line", () => {
    const sys = getCompetitorReportSectionSystemPrompt(1, 20, { planMonths: 5 });
    expect(sys).toContain("SCOPE: 5-month plan only.");
  });

  it("stitchCompetitorReportSections joins three blocks with blank lines", () => {
    const out = stitchCompetitorReportSections(["# A", "## B", "## C"]);
    expect(out).toBe("# A\n\n## B\n\n## C");
  });
});
