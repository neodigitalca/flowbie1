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

  it("repairs missing ul without throwing", () => {
    const html = "<h2>Overview</h2><p>Lead paragraph about dental care.</p>";
    const out = completeOverviewScrollLinks(html, anchors);
    expect(out).toContain("<ul>");
    expect(out).toContain('href="#dental-services"');
    expect(out).toContain('href="#what-we-offer"');
    expect(out.match(/<li\b/gi)?.length).toBe(2);
  });

  it("accepts HarnessSectionAnchorEntry without emitting #undefined", () => {
    const html = "<h2>Overview</h2><p>Lead.</p>";
    const out = completeOverviewScrollLinks(html, [
      { sectionIndex: 1, displayTitle: "Dental Services Offered", anchorId: "dental-services" },
      { sectionIndex: 2, displayTitle: "What We Offer", anchorId: "what-we-offer" },
    ]);
    expect(out).not.toContain("#undefined");
    expect(out).toContain('href="#dental-services"');
  });

  it("replaces boilerplate see-below bullets with contextual copy", () => {
    const html = `<h2>Overview</h2><p>Lead.</p><ul>
<li><strong>Services</strong>: See <a href="#dental-services">dental services</a> below.</li>
<li><strong>Offerings</strong>: See <a href="#what-we-offer">what we offer</a> below.</li>
</ul>`;
    const out = completeOverviewScrollLinks(html, anchors);
    expect(out).not.toMatch(/see\s+.+\s+below/i);
    expect(out).toContain('href="#dental-services"');
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
});

describe("buildOverviewLinkRulesBlock", () => {
  it("requires model-written bullet list with markdown scroll links", () => {
    const block = buildOverviewLinkRulesBlock();
    expect(block).toContain("](#exact-id");
    expect(block).toContain("exactly ONE");
    expect(block).toContain("NO em dashes");
    expect(block).not.toContain("inserted automatically");
  });
});

describe("overviewScrollLinkUsesBoilerplate", () => {
  it("detects see below phrasing", () => {
    expect(overviewScrollLinkUsesBoilerplate("See <a href=\"#x\">y</a> below.")).toBe(true);
  });
});
