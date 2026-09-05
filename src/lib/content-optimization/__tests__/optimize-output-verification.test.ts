import { describe, expect, it } from "vitest";
import {
  extractH2Titles,
  normalizeHtmlForCompare,
} from "@/lib/content-optimization/optimize-output-verification";

const LIVE_HTML = `
<h2>Smart Blinds Automation Vs Traditional Blinds</h2>
<p>Traditional corded blinds still dominate many Calgary homes because they are familiar and inexpensive at first glance.</p>
<h2>PowerView Motorization Overview</h2>
<p>Many homeowners compare <a href="https://blindmagic.com/blog/powerview-guide/">PowerView</a> against manual options.</p>
`;

const NEW_HTML = `
<h2>How to Choose Between Automated and Manual Window Coverings</h2>
<p>Motorized systems reduce daily friction when windows are hard to reach or grouped on large expanses of glass.</p>
<h2>Brand and Control Options Worth Comparing</h2>
<p>Compare <a href="https://blindmagic.com/hunter-douglas/">Hunter Douglas</a> product lines before you decide on a control platform.</p>
`;

describe("optimize-output-verification", () => {
  it("detects identical normalized HTML", () => {
    expect(normalizeHtmlForCompare(LIVE_HTML)).not.toBe(normalizeHtmlForCompare(NEW_HTML));
  });

  it("extractH2Titles returns heading text", () => {
    const headings = extractH2Titles(LIVE_HTML);
    expect(headings).toContain("Smart Blinds Automation Vs Traditional Blinds");
    expect(headings).toContain("PowerView Motorization Overview");
  });
});
