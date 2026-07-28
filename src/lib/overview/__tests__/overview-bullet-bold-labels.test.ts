import { describe, expect, it } from "vitest";
import {
  ensureOverviewBulletBoldLabels,
  overviewBulletsHaveBoldLabels,
} from "@/lib/overview/overview-bullet-bold-labels";

describe("ensureOverviewBulletBoldLabels", () => {
  it("wraps plain Label, description as strong Label:", () => {
    const html = `<ul><li>Cost Breakdown, discover the average costs.</li><li>Key Factors, learn about materials.</li><li>Types & Pricing, explore options.</li></ul>`;
    const out = ensureOverviewBulletBoldLabels(html);
    expect(out).toContain("<strong>Cost Breakdown</strong>: discover");
    expect(out).toContain("<strong>Key Factors</strong>: learn");
    expect(out).toContain("<strong>Types & Pricing</strong>: explore");
    expect(overviewBulletsHaveBoldLabels(out)).toBe(true);
  });

  it("converts bold Label, to bold Label:", () => {
    const html = `<ul><li><strong>Construction</strong>, honeycomb shades feature cellular design.</li><li><strong>Energy Efficiency</strong>, cellular structure helps.</li><li><strong>Aesthetics & Light Control</strong>, pleated shades offer a classic look.</li></ul>`;
    const out = ensureOverviewBulletBoldLabels(html);
    expect(out).toContain("<strong>Construction</strong>: honeycomb");
    expect(out).toContain("<strong>Energy Efficiency</strong>: cellular");
    expect(out).toContain("<strong>Aesthetics & Light Control</strong>: pleated");
    expect(out).not.toContain("</strong>,");
  });

  it("leaves already-correct bold Label: alone", () => {
    const html = `<ul><li><strong>Cost</strong>: one.</li><li><strong>Key</strong>: two.</li><li><strong>Types</strong>: three.</li></ul>`;
    expect(ensureOverviewBulletBoldLabels(html)).toBe(html);
  });
});
