import { describe, expect, it } from "vitest";
import {
  OVERVIEW_AUDIT_FULL_POST_LABEL,
  OVERVIEW_AUDIT_PREAMBLE_LABEL,
  concatenateOverviewAuditSectionHtml,
  splitHtmlForOverviewAudit,
} from "@/lib/overview/overview-post-html-audit-sections";

describe("splitHtmlForOverviewAudit", () => {
  it("returns a single slice when no h2", () => {
    const html = "<p>Lead only</p><div>More</div>";
    const s = splitHtmlForOverviewAudit(html);
    expect(s).toEqual([
      { sectionIndex: 0, sectionLabel: OVERVIEW_AUDIT_FULL_POST_LABEL, html },
    ]);
  });

  it("maps preamble plus two h2-led sections verbatim", () => {
    const html =
      '<p class="intro">Intro</p>\n<h2 id="one"> First </h2><p>a</p><h2>Second &amp; Title</h2><p>b</p>';
    const sections = splitHtmlForOverviewAudit(html);
    expect(sections).toHaveLength(3);
    expect(sections[0]?.sectionLabel).toBe(OVERVIEW_AUDIT_PREAMBLE_LABEL);
    expect(sections[0]?.html).toBe('<p class="intro">Intro</p>\n');
    expect(sections[1]?.sectionLabel).toBe("First");
    expect(sections[1]?.html.startsWith('<h2 id="one">')).toBe(true);
    expect(html.includes(sections[1]?.html ?? "")).toBe(true);
    expect(sections[2]?.sectionLabel).toContain("Second");
    expect(html.endsWith(sections[2]?.html ?? "")).toBe(true);
    expect([0, 1, 2]).toEqual(sections.map((x) => x.sectionIndex));
  });

  it("starts at first h2 when there is no preamble", () => {
    const html = "<h2>Only</h2><p>x</p><h2>Two</h2><p>y</p>";
    const s = splitHtmlForOverviewAudit(html);
    expect(s).toHaveLength(2);
    expect(s.every((sec) => sec.sectionLabel !== OVERVIEW_AUDIT_PREAMBLE_LABEL)).toBe(true);
  });

  it("does not split on false h2 inside comments or scripts", () => {
    const html =
      "<!-- <h2>fake</h2> -->" +
      "<script>var s='<h2>bad</h2>';</script>" +
      '<style>h2{font-size:2rem}</style>' +
      "<h2>Real</h2><p>p</p>";
    const sections = splitHtmlForOverviewAudit(html);
    expect(sections).toHaveLength(2);
    expect(sections[0]?.sectionLabel).toBe(OVERVIEW_AUDIT_PREAMBLE_LABEL);
    expect(sections[1]?.sectionLabel).toBe("Real");
    expect(
      concatenateOverviewAuditSectionHtml(sections),
      "comments/scripts slice concat matches original html",
    ).toBe(html);
  });

  it("concatenateOverviewAuditSectionHtml round-trips splitHtmlForOverviewAudit", () => {
    const fixtures = [
      '<p class="intro">Intro</p>\n<h2 id="one"> First </h2><p>a</p><h2>Second &amp; Title</h2><p>b</p>',
      "<h2>Only</h2><p>x</p><h2>Two</h2><p>y</p>",
      "<p>Lead only</p><div>More</div>",
    ];
    for (const html of fixtures) {
      const sections = splitHtmlForOverviewAudit(html);
      expect(
        concatenateOverviewAuditSectionHtml(sections),
        `round-trip for fixture length=${html.length}`,
      ).toBe(html);
    }
  });
});
