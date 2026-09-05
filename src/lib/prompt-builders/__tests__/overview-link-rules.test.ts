import { describe, expect, it } from "vitest";
import {
  buildOverviewLinkRulesBlock,
  completeOverviewScrollLinks,
  expandOverviewScrollLinkPlaceholders,
  expandOverviewScrollLinkPlaceholdersInMarkdown,
  overviewScrollLinkUsesBoilerplate,
  parseInPageAnchorsFromBlock,
} from "@/lib/prompt-builders/overview-link-rules";
import { markdownToHtml } from "@/lib/markdown-to-html";

const SAMPLE_ANCHOR_BLOCK = `=== OVERVIEW SCROLL-LINK TARGETS ===
Section 1 → #dental-services → "Dental Services Offered"
Section 2 → #what-we-offer → "What We Offer"
=== END ===`;

describe("expandOverviewScrollLinkPlaceholders", () => {
  it("converts SCROLL tokens to anchor tags", () => {
    const html =
      "<li><strong>Care</strong>: Choose our [[SCROLL:#dental-services|preventive cleaning]] for visits.</li>";
    expect(expandOverviewScrollLinkPlaceholders(html)).toContain(
      '<a href="#dental-services">preventive cleaning</a>',
    );
  });
});

describe("expandOverviewScrollLinkPlaceholdersInMarkdown", () => {
  it("converts SCROLL tokens to markdown hash links before marked", () => {
    const md =
      "- **Care:** Choose our [[SCROLL:#dental-services|preventive cleaning]] for visits.";
    expect(expandOverviewScrollLinkPlaceholdersInMarkdown(md)).toContain(
      "[preventive cleaning](#dental-services)",
    );
    expect(expandOverviewScrollLinkPlaceholdersInMarkdown(md)).not.toContain("[[SCROLL:");
  });
});

describe("overview markdown upload path", () => {
  it("renders overview scroll bullets as hash anchor links", async () => {
    const anchors = parseInPageAnchorsFromBlock(SAMPLE_ANCHOR_BLOCK);
    const md = `## Overview

Lead paragraph about dental care.

- **Services:** Explore our [[SCROLL:#dental-services|preventive care]] in this guide.
- **Offerings:** Review [[SCROLL:#what-we-offer|routine check-ups]] for families.

## Dental Services Offered

Body content here.

## What We Offer

More body content.`;
    let html = await markdownToHtml(expandOverviewScrollLinkPlaceholdersInMarkdown(md));
    html = completeOverviewScrollLinks(html, anchors);
    expect(html).toContain('href="#dental-services"');
    expect(html).toContain('href="#what-we-offer"');
    expect(html).not.toMatch(/\]\s*\./);
  });
});

describe("completeOverviewScrollLinks", () => {
  const anchors = parseInPageAnchorsFromBlock(SAMPLE_ANCHOR_BLOCK);

  it("preserves contextual copy and fixes href ids", () => {
    const html = `<h2>Overview</h2><p>Lead.</p><ul>
<li><strong>Services</strong>: Our [[SCROLL:#dental-services|preventive care]] covers cleanings.</li>
<li><strong>Offerings</strong>: Explore [[SCROLL:#what-we-offer|routine check-ups]] for families.</li>
</ul>`;
    const out = completeOverviewScrollLinks(html, anchors);
    expect(out).toContain('href="#dental-services"');
    expect(out).toContain('href="#what-we-offer"');
    expect(out).not.toContain("see below");
  });

  it("passthrough when overview ul is missing instead of inserting stub bullets", () => {
    const html = "<h2>Overview</h2><p>Lead paragraph about dental care.</p>";
    const out = completeOverviewScrollLinks(html, anchors);
    expect(out).toContain("Lead paragraph about dental care");
    expect(out).not.toContain("<ul>");
  });

  it("accepts HarnessSectionAnchorEntry without emitting #undefined", () => {
    const html = `<h2>Overview</h2><p>Lead.</p><ul>
<li><strong>Services</strong>: Explore our [[SCROLL:#dental-services|preventive care]] in this guide.</li>
<li><strong>Offerings</strong>: Review [[SCROLL:#what-we-offer|routine check-ups]] for families.</li>
</ul>`;
    const out = completeOverviewScrollLinks(html, [
      { sectionIndex: 1, displayTitle: "Dental Services Offered", anchorId: "dental-services" },
      { sectionIndex: 2, displayTitle: "What We Offer", anchorId: "what-we-offer" },
    ]);
    expect(out).not.toContain("#undefined");
    expect(out).toContain('href="#dental-services"');
  });

  it("passthrough on see-below boilerplate instead of replacing with SEO stubs", () => {
    const html = `<h2>Overview</h2><p>Lead.</p><ul>
<li><strong>Services</strong>: See <a href="#dental-services">dental services</a> below.</li>
<li><strong>Offerings</strong>: Explore [[SCROLL:#what-we-offer|routine check-ups]] for families.</li>
</ul>`;
    const out = completeOverviewScrollLinks(html, anchors);
    expect(out).toContain("below");
    expect(out).toContain('href="#what-we-offer"');
  });

  it("repairs bare (#id) overview bullet leaks", () => {
    const html = `<h2>Overview</h2><p>Lead.</p><ul>
<li><strong>Replacement Timing</strong>: Identify indicators that suggest it is time to (#when-to-replace-your-hunter-douglas-battery-wand).</li>
</ul>`;
    const out = completeOverviewScrollLinks(html, [
      {
        sectionIndex: 1,
        displayTitle: "When To Replace Your Hunter Douglas Battery Wand",
        anchorId: "when-to-replace-your-hunter-douglas-battery-wand",
      },
    ]);
    expect(out).toContain('href="#when-to-replace-your-hunter-douglas-battery-wand"');
    expect(out).not.toMatch(/\(#when-to-replace/);
  });

  it("inserts planned hash link when bullet prose has no hash anchor", () => {
    const html = `<h2>Overview</h2><p>Lead.</p><ul>
<li><strong>Services</strong>: Plain overview copy about preventive care options.</li>
</ul>`;
    const out = completeOverviewScrollLinks(html, [anchors[0]!]);
    expect(out).toContain("Plain overview copy about preventive care options");
    expect(out).toContain('href="#dental-services"');
    expect(out).not.toMatch(/\(#/);
  });

  it("rewaves appended hash links into the sentence when possible", () => {
    const html = `<h2>Overview</h2><p>Lead.</p><ul>
<li><strong>Home Entryways</strong>: Discover sidelight solutions for your front door's narrow windows. <a href="#sidelight-window-blinds-for-plum-coulee-homes">sidelight solutions</a></li>
</ul>`;
    const out = completeOverviewScrollLinks(html, [
      { sectionIndex: 1, displayTitle: "Sidelight Window Blinds", anchorId: "sidelight-window-blinds-for-plum-coulee-homes" },
    ]);
    const liMatch = out.match(/<li[^>]*>[\s\S]*?<\/li>/i)?.[0] ?? "";
    expect(liMatch).toContain('href="#sidelight-window-blinds-for-plum-coulee-homes"');
    expect(liMatch).toContain("<strong>Home Entryways</strong>:");
    expect(liMatch).not.toMatch(/windows\.\s*<a\b/i);
  });

  it("rewaves label-echo overview links using a matching word from link text", () => {
    const html = `<h2>Overview</h2><p>Lead.</p><ul>
<li><strong>Alberta Tax Brackets</strong>: Learn about the specific income tiers and their corresponding tax rates for Alberta. <a href="#alberta-tax-brackets">Alberta tax brackets</a></li>
</ul>`;
    const out = completeOverviewScrollLinks(html, [
      { sectionIndex: 1, displayTitle: "Alberta Tax Brackets Near Sherwood Park", anchorId: "alberta-tax-brackets" },
    ]);
    const liMatch = out.match(/<li[^>]*>[\s\S]*?<\/li>/i)?.[0] ?? "";
    expect(liMatch).toContain('href="#alberta-tax-brackets"');
    expect(liMatch).toMatch(/<a[^>]*href="#alberta-tax-brackets"[^>]*>Alberta<\/a>/i);
    expect(liMatch).not.toMatch(/Alberta\.\s*<a\b/i);
  });

  it("moves appended hash links before the period when prose has no exact phrase match", () => {
    const html = `<h2>Overview</h2><p>Lead.</p><ul>
<li><strong>KWB Services</strong>: Discover how our firm supports Sherwood Park residents with tax preparation and advice. <a href="#kwb-services">KWB services</a></li>
</ul>`;
    const out = completeOverviewScrollLinks(html, [
      { sectionIndex: 1, displayTitle: "KWB Services", anchorId: "kwb-services" },
    ]);
    const liMatch = out.match(/<li[^>]*>[\s\S]*?<\/li>/i)?.[0] ?? "";
    expect(liMatch).toContain('href="#kwb-services"');
    expect(liMatch).toContain("KWB services");
    expect(liMatch).toMatch(/<a[^>]*>KWB services<\/a>\./i);
    expect(liMatch).not.toMatch(/advice\.\s*<a\b/i);
  });

  it("passthrough on corrupted hash markup instead of synthesizing a replacement bullet", () => {
    const html = `<h2>Overview</h2><p>Lead.</p><ul>
<li><strong>Product Range</strong>: See the range of <a href="#<a href=&quot;#what-we-offer&quot;>window</a>-treatments">window treatments</a> we offer.</li>
</ul>`;
    const out = completeOverviewScrollLinks(html, [
      { sectionIndex: 1, displayTitle: "What We Offer", anchorId: "what-we-offer-blinds-and-window-treatments" },
    ]);
    expect(out).toContain("window treatments");
  });

  it("strips duplicate hash links from one overview bullet", () => {
    const html = `<h2>Overview</h2><p>Lead.</p><ul>
<li><strong>Lifetime Guarantee</strong>: Review the <a href="#dental-services">Hunter Douglas guarantee policy</a>, including <a href="#dental-services">hunter douglas lifetime guarantee</a>.</li>
</ul>`;
    const out = completeOverviewScrollLinks(html, [anchors[0]!]);
    const liMatch = out.match(/<li[^>]*>[\s\S]*?<\/li>/i)?.[0] ?? "";
    expect(liMatch.match(/<a\b[^>]*href\s*=\s*["']#/gi)?.length).toBe(1);
    expect(out).not.toContain("including <a");
  });

  it("keeps a single model-woven hash link without appending a duplicate", () => {
    const html = `<h2>Overview</h2><p>Lead.</p><ul>
<li><strong>Product Variety</strong>: See the range of <a href="#what-we-offer">window treatments</a> we offer for every room.</li>
</ul>`;
    const once = completeOverviewScrollLinks(html, [anchors[1]!]);
    const twice = completeOverviewScrollLinks(once, [anchors[1]!]);
    const liMatch = twice.match(/<li[^>]*>[\s\S]*?<\/li>/i)?.[0] ?? "";
    expect(liMatch.match(/<a\b[^>]*href\s*=\s*["']#what-we-offer/gi)?.length).toBe(1);
    expect(liMatch).toContain("window treatments");
    expect(liMatch).not.toContain("what we offer:");
  });
});

describe("buildOverviewLinkRulesBlock", () => {
  it("requires model-written bullet list with hash links and forbids SEO stubs", () => {
    const block = buildOverviewLinkRulesBlock();
    expect(block).toContain('href="#exact-id"');
    expect(block).toContain("exactly ONE");
    expect(block).toContain("fits your SEO plan");
    expect(block).toContain("Lead with what remaining sections cover");
    expect(block).toContain("Do not answer the article question again");
    expect(block).not.toContain("inserted automatically");
  });

  it("requires Real-World Example bullet when illustrative anchor is present", () => {
    const block = buildOverviewLinkRulesBlock({ hasIllustrativeAnchor: true });
    expect(block).toContain("Real-World Example");
    expect(block).toContain("labeled real-world hypothetical");
  });
});

describe("overviewScrollLinkUsesBoilerplate", () => {
  it("detects see below and SEO stub phrasing", () => {
    expect(overviewScrollLinkUsesBoilerplate("See <a href=\"#x\">y</a> below.")).toBe(true);
    expect(overviewScrollLinkUsesBoilerplate("See how solar fits your SEO plan.")).toBe(true);
  });
});
