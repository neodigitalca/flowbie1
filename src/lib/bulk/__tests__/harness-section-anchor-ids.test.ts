import { describe, expect, it } from "vitest";
import type { AgentConfig } from "@/types/agent-config";
import { BLOG_HARNESS_SUMMARY_AGENT_ID } from "@/lib/bulk/blog-harness-summary-agent";
import type { BulkHarnessOutlineSection } from "@/lib/bulk/bulk-harness-outline";
import {
  buildHarnessSectionAnchorMap,
  formatHarnessInPageAnchorBlock,
  headingTitleToHarnessAnchorId,
  HARNESS_OVERVIEW_ANCHOR_ID,
  injectHarnessSectionH2AnchorId,
  resolveHarnessSectionInjectAnchorId,
} from "@/lib/bulk/harness-section-anchor-ids";

function outlineRow(
  index: number,
  title: string,
  agentId = `agent-${index}`,
): BulkHarnessOutlineSection {
  const agent: AgentConfig = {
    id: agentId,
    step: index + 1,
    title,
    description: "",
    features: [],
    headingLevel: 1,
  };
  return {
    index,
    title,
    displayTitle: title,
    description: "",
    headingLevel: 1,
    isFaq: false,
    agent,
  };
}

describe("headingTitleToHarnessAnchorId", () => {
  it("slugifies titles with punctuation", () => {
    expect(headingTitleToHarnessAnchorId("What Does a Solar Installer Do? Roles and Responsibilities")).toBe(
      "what-does-a-solar-installer-do-roles-and-responsibilities",
    );
  });

  it("strips simple HTML from titles", () => {
    expect(headingTitleToHarnessAnchorId("<strong>Safety First</strong>: Key Tips")).toBe(
      "safety-first-key-tips",
    );
  });
});

describe("buildHarnessSectionAnchorMap", () => {
  it("skips Overview / summary agent and dedupes similar titles", () => {
    const outline = [
      outlineRow(0, "Overview", BLOG_HARNESS_SUMMARY_AGENT_ID),
      outlineRow(1, "Cost Guide"),
      outlineRow(2, "Cost Guide!"),
      outlineRow(3, "Safety First"),
    ];
    const map = buildHarnessSectionAnchorMap(outline);
    expect(map).toHaveLength(3);
    expect(map[0]?.anchorId).toBe("cost-guide");
    expect(map[1]?.anchorId).toBe("cost-guide-2");
    expect(map[2]?.anchorId).toBe("safety-first");
    expect(map.every((e) => e.sectionIndex > 0)).toBe(true);
  });
});

describe("injectHarnessSectionH2AnchorId", () => {
  it("adds id on the first h2", () => {
    const html = "<h2>Overview</h2>\n<p>Lead.</p>";
    expect(injectHarnessSectionH2AnchorId(html, HARNESS_OVERVIEW_ANCHOR_ID)).toBe(
      '<h2 id="overview">Overview</h2>\n<p>Lead.</p>',
    );
  });

  it("replaces an existing id on the first h2", () => {
    const html = '<h2 class="wp-block-heading" id="old">Body</h2><p>x</p>';
    expect(injectHarnessSectionH2AnchorId(html, "body-section")).toBe(
      '<h2 class="wp-block-heading" id="body-section">Body</h2><p>x</p>',
    );
  });
});

describe("resolveHarnessSectionInjectAnchorId", () => {
  it("uses overview for index 0 and map entries for body sections", () => {
    const map = buildHarnessSectionAnchorMap([
      outlineRow(0, "Overview", BLOG_HARNESS_SUMMARY_AGENT_ID),
      outlineRow(1, "Hiring Tips"),
    ]);
    expect(resolveHarnessSectionInjectAnchorId(0, map)).toBe(HARNESS_OVERVIEW_ANCHOR_ID);
    expect(resolveHarnessSectionInjectAnchorId(1, map)).toBe("hiring-tips");
  });
});

describe("formatHarnessInPageAnchorBlock", () => {
  it("lists numbered bullets and mandatory 1:1 mapping", () => {
    const block = formatHarnessInPageAnchorBlock([
      { sectionIndex: 1, displayTitle: "Hiring Tips", anchorId: "hiring-tips" },
      { sectionIndex: 2, displayTitle: "Cost Guide", anchorId: "cost-guide" },
    ]);
    expect(block).toContain("exactly 2 Overview bullets");
    expect(block).toContain("Bullet 1 → #hiring-tips");
    expect(block).toContain("Bullet 2 → #cost-guide");
    expect(block).toContain("Hiring Tips");
    expect(block).toContain("IN-PAGE SECTION ANCHORS");
    expect(block).toContain("CLICK-TO-SCROLL ONLY");
    expect(block).toContain("NON-NEGOTIABLE");
    expect(block).toContain("2–4 word");
    expect(block).toContain("Do not skip any anchor");
  });
});
