import { describe, expect, it } from "vitest";
import {
  FLO_OVERVIEW_CLASS,
  wrapOverviewSectionHtml,
} from "@/lib/overview/wrap-overview-section-html";

describe("wrapOverviewSectionHtml", () => {
  it("wraps bare Overview HTML once", () => {
    const inner = `<h2 id="overview">Overview</h2><p>Lead</p><ul><li><strong>A</strong>: one</li></ul>`;
    const out = wrapOverviewSectionHtml(inner);
    expect(out.startsWith(`<div class="${FLO_OVERVIEW_CLASS}">`)).toBe(true);
    expect(out.endsWith("</div>")).toBe(true);
    expect(out).toContain(inner);
  });

  it("is idempotent when already wrapped", () => {
    const inner = `<h2 id="overview">Overview</h2><p>Lead</p>`;
    const once = wrapOverviewSectionHtml(inner);
    const twice = wrapOverviewSectionHtml(once);
    expect(twice).toBe(once);
  });

  it("returns empty trimmed input unchanged", () => {
    expect(wrapOverviewSectionHtml("")).toBe("");
    expect(wrapOverviewSectionHtml("   ")).toBe("");
  });
});
