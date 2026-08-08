import { describe, expect, it } from "vitest";
import { removeNonWikipediaExternalLinks } from "@/lib/content-generation/content-sanitizer";
import {
  assertHarnessExternalLinksValid,
  buildAllowedExternalPairs,
  buildRowExplicitExternalAllowlist,
  ensureAllLinkAnchorsInHtml,
  externalUrlsFromPairs,
  parseExternalSemrushPairsFromAgents,
  resolveExternalLinkPlaceholdersInHtml,
  wrapBareExternalUrlsInHtml,
} from "@/lib/content-generation/external-link-placeholders";

const PAIR = {
  url: "https://help.hunterdouglas.com/hc/en-us/articles/39534899498516",
  anchor: "Hunter Douglas warranty coverage",
};

const WFNC_PAIR = {
  url: "https://www.wfnc.com/services/hunter-douglas-lifetime-limited-warranty/",
  anchor: "Hunter Douglas lifetime limited warranty",
};

describe("buildRowExplicitExternalAllowlist", () => {
  it("returns empty when row has no explicit links", () => {
    expect(buildRowExplicitExternalAllowlist({})).toEqual([]);
    expect(externalUrlsFromPairs([])).toEqual([]);
  });

  it("merges modifier and imported draft links only", () => {
    const pairs = buildRowExplicitExternalAllowlist({
      modifierExternalLinks: [{ url: WFNC_PAIR.url, anchorText: WFNC_PAIR.anchor }],
      importedDraftLinks: [{ url: "https://example.com/x", anchorText: "Example resource" }],
    });
    expect(pairs).toHaveLength(2);
    expect(pairs.map((pair) => pair.url)).toContain(WFNC_PAIR.url);
  });
});

describe("wrapBareExternalUrlsInHtml", () => {
  it("wraps bare approved external URLs with anchor text", () => {
    const html =
      "<p>Sources like WFNC.com cover warranty details: https://www.wfnc.com/services/hunter-douglas-lifetime-limited-warranty/.</p>";
    const out = wrapBareExternalUrlsInHtml(html, [WFNC_PAIR]);
    expect(out).toContain(`<a href="${WFNC_PAIR.url}">${WFNC_PAIR.anchor}</a>.`);
    expect(out).not.toMatch(/warranty details: https:\/\//);
  });
});

describe("ensureAllLinkAnchorsInHtml", () => {
  it("replaces here and raw URL labels with approved anchor text", () => {
    const html = `<p>See <a href="${WFNC_PAIR.url}">here</a> and <a href="${WFNC_PAIR.url}">${WFNC_PAIR.url}</a>.</p>`;
    const out = ensureAllLinkAnchorsInHtml(html, [WFNC_PAIR]);
    expect(out).not.toContain(">here</a>");
    expect(out).not.toContain(`>${WFNC_PAIR.url}</a>`);
    expect(out).toContain(`>${WFNC_PAIR.anchor}</a>`);
  });

  it("fills empty hash link labels from anchor id", () => {
    const html = '<li><strong>Impact</strong>: see <a href="#2026-bc-pst-expansion-business-impact"></a>.</li>';
    const out = ensureAllLinkAnchorsInHtml(html, []);
    expect(out).toContain('href="#2026-bc-pst-expansion-business-impact">2026 Bc Pst Expansion Business Impact</a>');
  });
});

describe("resolveExternalLinkPlaceholdersInHtml", () => {
  it("replaces valid [[EXTERNAL:url|anchor]] with anchor tag", () => {
    const html = `<p>Review our [[EXTERNAL:${PAIR.url}|${PAIR.anchor}]] before filing a claim.</p>`;
    const out = resolveExternalLinkPlaceholdersInHtml(html, [PAIR]);
    expect(out).toContain(`<a href="${PAIR.url}">${PAIR.anchor}</a>`);
    expect(out).not.toContain("[[EXTERNAL:");
  });

  it("strips unauthorized placeholders to plain anchor text", () => {
    const url = "https://help.hunterdouglas.com/hc/en-us/articles/39561061650964";
    const anchor = "What is the warranty for motorized components";
    const html = `<p>See [[EXTERNAL:${url}|${anchor}]] for details.</p>`;
    const out = resolveExternalLinkPlaceholdersInHtml(html, []);
    expect(out).toContain(anchor);
    expect(out).not.toContain("<a href=");
    expect(out).not.toContain("[[EXTERNAL:");
  });

  it("replaces bare [[EXTERNAL]] when one allowed pair exists", () => {
    const html = "<p>See [[EXTERNAL]] for warranty terms.</p>";
    const out = resolveExternalLinkPlaceholdersInHtml(html, [PAIR]);
    expect(out).toContain(`<a href="${PAIR.url}">${PAIR.anchor}</a>`);
  });
});

describe("row-only external sanitize path", () => {
  it("removes third-party links when row allowlist is empty", () => {
    const html = `<p>See <a href="${WFNC_PAIR.url}">${WFNC_PAIR.anchor}</a> for details.</p>`;
    const out = removeNonWikipediaExternalLinks(html, "https://blindmagic.com", undefined, []);
    expect(out).not.toContain("wfnc.com");
    expect(out).not.toContain("<a href=");
  });
});

describe("parseExternalSemrushPairsFromAgents", () => {
  it("parses EXTERNAL_SEMRUSH blueprint features", () => {
    const pairs = parseExternalSemrushPairsFromAgents([
      {
        features: [
          `[EXTERNAL_SEMRUSH]: href=${PAIR.url} | anchor=${PAIR.anchor}`,
        ],
      },
    ]);
    expect(pairs).toEqual([PAIR]);
  });
});

describe("assertHarnessExternalLinksValid", () => {
  it("throws when model writes raw external anchor tag", () => {
    expect(() =>
      assertHarnessExternalLinksValid(
        `<h2>T</h2><p>See <a href="${PAIR.url}">bad</a> for details.</p>`,
        { title: "T", siteUrl: "https://blindmagic.com", allowedPairs: [PAIR] },
      ),
    ).toThrow(/AI-written external link/);
  });

  it("allows valid external placeholder", () => {
    expect(() =>
      assertHarnessExternalLinksValid(
        `<h2>T</h2><p>See [[EXTERNAL:${PAIR.url}|${PAIR.anchor}]] for details.</p>`,
        { title: "T", siteUrl: "https://blindmagic.com", allowedPairs: [PAIR] },
      ),
    ).not.toThrow();
  });

  it("throws on parenthetical footnote", () => {
    expect(() =>
      assertHarnessExternalLinksValid(
        '<h2>T</h2><p>Schedule service. (Hunter Douglas repair options).</p>',
        { title: "T", allowedPairs: [PAIR] },
      ),
    ).toThrow(/parenthetical footnote/);
  });
});

describe("buildAllowedExternalPairs", () => {
  it("uses modifier links only, not blueprint Semrush features", () => {
    const pairs = buildAllowedExternalPairs(
      [{ features: [`[EXTERNAL_SEMRUSH]: href=${PAIR.url} | anchor=${PAIR.anchor}`] }],
      [{ url: "https://example.com/x", anchorText: "Example resource" }],
    );
    expect(pairs).toEqual([{ url: "https://example.com/x", anchor: "Example resource" }]);
  });
});
