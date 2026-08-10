import { describe, expect, it, vi, beforeEach } from "vitest";
import type { HarnessSectionAnchorEntry } from "@/lib/bulk/harness-section-anchor-ids";
import {
  applyOverviewHarnessScrollLinks,
  applyOverviewHarnessScrollLinksToStitchedHtml,
  rebuildOverviewWithScrollLinkBullets,
  stripOverviewBulletList,
  verifyOverviewHarnessScrollLinks,
  reconcileOverviewScrollLinksToBodyH2Ids,
  extractBodyH2AnchorsFromHtml,
} from "@/lib/overview/overview-harness-scroll-links";

vi.mock("@/lib/competitor-research/competitor-report-openrouter", () => ({
  callOpenRouterChatCompletion: vi.fn(),
}));

import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";

beforeEach(() => {
  vi.mocked(callOpenRouterChatCompletion).mockReset();
});

const anchorMap: HarnessSectionAnchorEntry[] = [
  { sectionIndex: 1, displayTitle: "Policy Context", anchorId: "policy-context" },
  { sectionIndex: 2, displayTitle: "Financial Impact", anchorId: "financial-impact" },
];

const compliantHtml = `<h2>Overview</h2>
<p>Alberta physician privatization changes affect billing.</p>
<ul>
<li><strong>Policy</strong>: reforms include <a href="#policy-context">policy shifts</a> across the province.</li>
<li><strong>Finance</strong>: practices face <a href="#financial-impact">cost pressures</a> under new rules.</li>
</ul>`;

describe("stripOverviewBulletList", () => {
  it("removes the first ul block and keeps lead copy", () => {
    const out = stripOverviewBulletList(compliantHtml);
    expect(out).toContain("<h2>Overview</h2>");
    expect(out).toContain("<p>Alberta physician");
    expect(out).not.toContain("<ul>");
  });
});

describe("rebuildOverviewWithScrollLinkBullets", () => {
  it("builds one li per bullet with bold label", () => {
    const head = "<h2>Overview</h2>\n<p>Lead.</p>";
    const out = rebuildOverviewWithScrollLinkBullets(head, [
      {
        anchorId: "policy-context",
        bulletLabel: "Policy",
        sentenceHtml: 'See <a href="#policy-context">policy shifts</a> for details.',
      },
    ]);
    expect(out).toContain("<strong>Policy</strong>:");
    expect(out).toContain('href="#policy-context"');
  });
});

describe("verifyOverviewHarnessScrollLinks", () => {
  it("passes when every anchor appears exactly once", () => {
    expect(() => verifyOverviewHarnessScrollLinks(compliantHtml, anchorMap)).not.toThrow();
  });

  it("throws when bullet count mismatches anchor map", () => {
    const html = `<h2>Overview</h2><ul>
<li><strong>Only</strong>: one <a href="#policy-context">link</a>.</li>
</ul>`;
    expect(() => verifyOverviewHarnessScrollLinks(html, anchorMap)).toThrow(/expected 2 bullets/);
  });

  it("throws when an anchor is missing", () => {
    const html = `<h2>Overview</h2><ul>
<li><strong>A</strong>: <a href="#policy-context">one</a>.</li>
<li><strong>B</strong>: <a href="#policy-context">dup</a>.</li>
</ul>`;
    expect(() => verifyOverviewHarnessScrollLinks(html, anchorMap)).toThrow(/must appear exactly once/);
  });

  it("throws on non-# hrefs when anchors are satisfied", () => {
    const html = `<h2>Overview</h2><ul>
<li><strong>A</strong>: <a href="#policy-context">one</a> and <a href="https://example.com">bad</a>.</li>
<li><strong>B</strong>: <a href="#financial-impact">two</a>.</li>
</ul>`;
    expect(() => verifyOverviewHarnessScrollLinks(html, anchorMap)).toThrow(/forbidden non-# href/);
  });

  it("throws on empty anchor map", () => {
    expect(() => verifyOverviewHarnessScrollLinks(compliantHtml, [])).toThrow(/anchor map is empty/);
  });
});

describe("applyOverviewHarnessScrollLinks", () => {
  it("always rebuilds ul from OpenRouter JSON and verifies", async () => {
    vi.mocked(callOpenRouterChatCompletion).mockResolvedValueOnce({
      content: JSON.stringify({
        bullets: [
          {
            anchorId: "policy-context",
            bulletLabel: "Policy",
            sentenceHtml: 'Track <a href="#policy-context">policy shifts</a> in Alberta.',
          },
          {
            anchorId: "financial-impact",
            bulletLabel: "Finance",
            sentenceHtml: 'Review <a href="#financial-impact">cost pressures</a> for clinics.',
          },
        ],
      }),
    });

    const draft = `<h2>Overview</h2><p>Lead paragraph.</p><ul><li><strong>Old</strong>: stale.</li></ul>`;
    const out = await applyOverviewHarnessScrollLinks({
      html: draft,
      anchorMap,
      articleTitle: "Alberta Physician Changes",
      keyword: "Alberta physician privatization",
      apiKey: "test-key",
    });

    expect(out).toContain('href="#policy-context"');
    expect(out).toContain('href="#financial-impact"');
    expect(out).not.toContain("stale");
    expect(callOpenRouterChatCompletion).toHaveBeenCalledTimes(1);
  });

  it("throws when anchor map is empty", async () => {
    await expect(
      applyOverviewHarnessScrollLinks({
        html: compliantHtml,
        anchorMap: [],
        articleTitle: "Title",
        keyword: "kw",
        apiKey: "test-key",
      }),
    ).rejects.toThrow(/without body H2 anchors/);
  });

  it("throws when model returns wrong bullet count", async () => {
    vi.mocked(callOpenRouterChatCompletion).mockResolvedValueOnce({
      content: JSON.stringify({
        bullets: [
          {
            anchorId: "policy-context",
            bulletLabel: "Policy",
            sentenceHtml: '<a href="#policy-context">one</a>',
          },
        ],
      }),
    });

    await expect(
      applyOverviewHarnessScrollLinks({
        html: compliantHtml,
        anchorMap,
        articleTitle: "Title",
        keyword: "kw",
        apiKey: "test-key",
      }),
    ).rejects.toThrow(/model returned 1 bullets, expected 2/);
  });
});

describe("applyOverviewHarnessScrollLinksToStitchedHtml", () => {
  it("rebuilds overview bullets and preserves body sections", async () => {
    vi.mocked(callOpenRouterChatCompletion).mockResolvedValueOnce({
      content: JSON.stringify({
        bullets: [
          {
            anchorId: "policy-context",
            bulletLabel: "Policy",
            sentenceHtml: 'Track <a href="#policy-context">policy shifts</a> in Alberta.',
          },
          {
            anchorId: "financial-impact",
            bulletLabel: "Finance",
            sentenceHtml: 'Review <a href="#financial-impact">cost pressures</a> for clinics.',
          },
        ],
      }),
    });

    const stitched = `<h2>Overview</h2>
<p>Lead paragraph.</p>
<ul><li><strong>Old</strong>: stale copy.</li></ul>

<h2 id="policy-context">Policy Context</h2>
<p>Body one.</p>
<h2 id="financial-impact">Financial Impact</h2>
<p>Body two.</p>`;

    const out = await applyOverviewHarnessScrollLinksToStitchedHtml({
      html: stitched,
      anchorMap,
      articleTitle: "Alberta Physician Changes",
      keyword: "Alberta physician privatization",
      apiKey: "test-key",
    });

    expect(out).toContain('href="#policy-context"');
    expect(out).toContain('href="#financial-impact"');
    expect(out).not.toContain("stale copy");
    expect(out).toContain("<h2 id=\"policy-context\">Policy Context</h2>");
    expect(out).toContain("<h2 id=\"financial-impact\">Financial Impact</h2>");
    expect(callOpenRouterChatCompletion).toHaveBeenCalledTimes(1);
  });

  it("returns html unchanged when no overview section exists", async () => {
    const bodyOnly = `<h2 id="policy-context">Policy Context</h2><p>Body.</p>`;
    const out = await applyOverviewHarnessScrollLinksToStitchedHtml({
      html: bodyOnly,
      anchorMap,
      articleTitle: "Title",
      keyword: "kw",
      apiKey: "test-key",
    });
    expect(out).toBe(bodyOnly);
    expect(callOpenRouterChatCompletion).not.toHaveBeenCalled();
  });
});

describe("reconcileOverviewScrollLinksToBodyH2Ids", () => {
  // Legacy upload / content-generation-upload path only. Bulk harness (generateMarkdownContentHarnessed)
  // Model writes contextual scroll-link <ul>; enforceOverviewScrollLinkHrefs fixes #ids. Bulk path does not call reconcile.
  const article = `<div class="flo-overview">
<h2 id="overview">Overview</h2>
<p>Lead paragraph.</p>
<ul>
<li><strong>Wrong</strong>: see <a href="#wrong-id">bad link</a>.</li>
</ul>
</div>

<h2 id="2026-bc-pst-expansion-business-impact">2026 BC PST Expansion: Business Impact</h2>
<p>Body one.</p>

<h2 id="5-new-pst-categories-explained">5 New PST Categories</h2>
<p>Body two.</p>`;

  it("extracts body H2 ids in order", () => {
    const anchors = extractBodyH2AnchorsFromHtml(article);
    expect(anchors).toHaveLength(2);
    expect(anchors[0]?.anchorId).toBe("2026-bc-pst-expansion-business-impact");
    expect(anchors[1]?.anchorId).toBe("5-new-pst-categories-explained");
  });

  it("rebuilds overview bullets to match body H2 ids", () => {
    const out = reconcileOverviewScrollLinksToBodyH2Ids(article);
    expect(out).toContain('href="#2026-bc-pst-expansion-business-impact"');
    expect(out).toContain('href="#5-new-pst-categories-explained"');
    expect(out).not.toContain("#wrong-id");
    expect(out).not.toContain(" for more.");
  });

  it("leaves html unchanged when overview hrefs already match body H2 ids", () => {
    const matched = `<div class="flo-overview">
<h2 id="overview">Overview</h2>
<p>Lead.</p>
<ul>
<li><strong>A</strong>: <a href="#policy-context">policy shifts</a>.</li>
<li><strong>B</strong>: <a href="#financial-impact">cost pressures</a>.</li>
</ul>
</div>
<h2 id="policy-context">Policy Context</h2><p>x</p>
<h2 id="financial-impact">Financial Impact</h2><p>y</p>`;
    expect(reconcileOverviewScrollLinksToBodyH2Ids(matched)).toBe(matched);
  });
});
