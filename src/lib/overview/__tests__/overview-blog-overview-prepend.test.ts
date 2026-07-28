import { describe, expect, it } from "vitest";
import {
  HARNESS_OVERVIEW_ANCHOR_ID,
} from "@/lib/bulk/harness-section-anchor-ids";
import {
  findH2OpenPositions,
  injectBodyH2AnchorIds,
  outlineFromBodyH2Titles,
  stitchOverviewOntoBody,
  stripLeadingOverviewSection,
} from "@/lib/overview/overview-blog-overview-prepend";
import { buildHarnessSectionAnchorMap } from "@/lib/bulk/harness-section-anchor-ids";
import { FLO_OVERVIEW_CLASS } from "@/lib/overview/wrap-overview-section-html";

describe("stripLeadingOverviewSection", () => {
  it("removes Overview H2 through the next H2", () => {
    const html = [
      `<h2 id="overview">Overview</h2>`,
      `<p>Lead</p>`,
      `<ul><li><strong>A</strong>, one</li></ul>`,
      `<h2>Cost Factors</h2>`,
      `<p>Body</p>`,
    ].join("");
    const out = stripLeadingOverviewSection(html);
    expect(out.toLowerCase()).not.toContain(">overview<");
    expect(out).toContain("Cost Factors");
    expect(out).toContain("Body");
  });

  it("removes Overview by title without id", () => {
    const html = `<h2>Overview</h2><p>x</p><h2>Next</h2><p>y</p>`;
    const out = stripLeadingOverviewSection(html);
    expect(out).toBe(`<h2>Next</h2><p>y</p>`);
  });

  it("removes every Overview section including H3 AIO", () => {
    const html = [
      `<h2 id="overview">Overview</h2><p>new</p><ul><li><strong>A</strong>, one</li></ul>`,
      `<h3>Overview</h3><p>old aio</p>`,
      `<h2>Unlock Shine</h2><p>body</p>`,
    ].join("");
    const out = stripLeadingOverviewSection(html);
    expect(out.toLowerCase()).not.toContain("overview");
    expect(out).not.toContain("old aio");
    expect(out).toContain("Unlock Shine");
    expect(out).toContain("body");
  });

  it("removes flo-overview wrapper with no residue", () => {
    const html = [
      `<div class="${FLO_OVERVIEW_CLASS}">`,
      `<h2 id="overview">Overview</h2>`,
      `<p>Lead</p>`,
      `<ul><li><strong>A</strong>: one</li></ul>`,
      `</div>`,
      `<h2>Cost Factors</h2>`,
      `<p>Body</p>`,
    ].join("");
    const out = stripLeadingOverviewSection(html);
    expect(out.toLowerCase()).not.toContain("flo-overview");
    expect(out.toLowerCase()).not.toContain(">overview<");
    expect(out).toBe(`<h2>Cost Factors</h2><p>Body</p>`);
  });

  it("dedupeStackedOverviewSections keeps first Overview only", async () => {
    const { dedupeStackedOverviewSections } = await import(
      "@/lib/overview/overview-blog-overview-prepend"
    );
    const html = [
      `<h2 id="overview">Overview</h2><p>NEW</p><ul><li><strong>A</strong>, one</li></ul>`,
      `<h2>Overview</h2><p>OLD</p>`,
      `<h2>Unlock Shine</h2><p>body</p>`,
    ].join("");
    const out = dedupeStackedOverviewSections(html);
    expect(out).toContain("NEW");
    expect(out).not.toContain("OLD");
    expect(out).toContain("Unlock Shine");
    const overviewCount = out.toLowerCase().split(">overview<").length - 1;
    expect(overviewCount).toBe(1);
  });

  it("dedupeStackedOverviewSections keeps wrapped Overview", async () => {
    const { dedupeStackedOverviewSections } = await import(
      "@/lib/overview/overview-blog-overview-prepend"
    );
    const html = [
      `<div class="${FLO_OVERVIEW_CLASS}">`,
      `<h2 id="overview">Overview</h2><p>NEW</p><ul><li><strong>A</strong>: one</li></ul>`,
      `</div>`,
      `<h2>Overview</h2><p>OLD</p>`,
      `<h2>Unlock Shine</h2><p>body</p>`,
    ].join("");
    const out = dedupeStackedOverviewSections(html);
    expect(out).toContain(`class="${FLO_OVERVIEW_CLASS}"`);
    expect(out).toContain("NEW");
    expect(out).not.toContain("OLD");
    expect(out).toContain("Unlock Shine");
    const overviewCount = out.toLowerCase().split(">overview<").length - 1;
    expect(overviewCount).toBe(1);
  });
});

describe("extractOverviewSectionHtml", () => {
  it("returns flo-overview wrapper when present", async () => {
    const { extractOverviewSectionHtml } = await import(
      "@/lib/overview/overview-blog-overview-prepend"
    );
    const html = [
      `<div class="${FLO_OVERVIEW_CLASS}">`,
      `<h2 id="overview">Overview</h2><p>Lead</p>`,
      `</div>`,
      `<h2>Next</h2><p>Body</p>`,
    ].join("");
    const out = extractOverviewSectionHtml(html);
    expect(out.startsWith(`<div class="${FLO_OVERVIEW_CLASS}">`)).toBe(true);
    expect(out).toContain("Lead");
    expect(out).not.toContain("Next");
    expect(out.endsWith("</div>")).toBe(true);
  });
});

describe("stitchOverviewOntoBody", () => {
  it("wraps Overview in flo-overview", () => {
    const result = stitchOverviewOntoBody({
      sourceHtml: `<h2>Cost Factors</h2><p>Body</p>`,
      overviewHtml: `<h2>Overview</h2><p>Lead</p><ul><li><strong>A</strong>: one</li></ul>`,
    });
    expect(result.html.startsWith(`<div class="${FLO_OVERVIEW_CLASS}">`)).toBe(true);
    expect(result.html).toContain(`id="${HARNESS_OVERVIEW_ANCHOR_ID}"`);
    expect(result.html).toContain("Cost Factors");
  });

  it("prepends Overview with overview id and injects body ids", () => {
    const body = `<h2>Cost Factors</h2><p>a</p><h2>Tax Rebates</h2><p>b</p>`;
    const overview = `<h2>Overview</h2><p>Answer</p><ul><li><strong>Cost</strong>, <a href="#cost-factors">cost factors</a>.</li></ul>`;
    const first = stitchOverviewOntoBody({ sourceHtml: body, overviewHtml: overview });
    expect(first.html.startsWith(`<div class="${FLO_OVERVIEW_CLASS}">`)).toBe(true);
    expect(first.html).toContain(`<h2 id="${HARNESS_OVERVIEW_ANCHOR_ID}">`);
    expect(first.html).toContain(`id="cost-factors"`);
    expect(first.html).toContain(`id="tax-rebates"`);
    expect(first.bodyH2Titles).toEqual(["Cost Factors", "Tax Rebates"]);

    const second = stitchOverviewOntoBody({
      sourceHtml: first.html,
      overviewHtml: `<h2>Overview</h2><p>Replaced</p><ul><li><strong>Cost</strong>, again.</li></ul>`,
    });
    const overviewCount = second.html.toLowerCase().split(">overview<").length - 1;
    expect(overviewCount).toBe(1);
    expect(second.html).toContain("Replaced");
    expect(second.html).not.toContain("Answer");
    expect(second.html.toLowerCase().split("flo-overview").length - 1).toBe(1);
  });
});

describe("looksLikeBlockedHostHtml", () => {
  it("flags Cloudflare Attention Required pages", async () => {
    const { looksLikeBlockedHostHtml } = await import(
      "@/lib/overview/overview-blog-overview-prepend"
    );
    expect(
      looksLikeBlockedHostHtml(
        `<!DOCTYPE html><html><title>Attention Required! | Cloudflare</title><body>cloudflare</body></html>`,
      ),
    ).toBe(true);
    expect(looksLikeBlockedHostHtml(`<h2>Cost</h2><p>ok</p>`)).toBe(false);
  });
});

describe("injectBodyH2AnchorIds", () => {
  it("sets id on each body H2 from the anchor map", () => {
    const html = `<h2>Cost Factors</h2><p>a</p><h2>Tax Rebates</h2><p>b</p>`;
    const map = buildHarnessSectionAnchorMap(outlineFromBodyH2Titles(["Cost Factors", "Tax Rebates"]));
    const out = injectBodyH2AnchorIds(html, map);
    expect(out).toContain(`id="cost-factors"`);
    expect(out).toContain(`id="tax-rebates"`);
    expect(findH2OpenPositions(out)).toHaveLength(2);
  });
});
