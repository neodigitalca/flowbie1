import { describe, expect, it } from "vitest";
import {
  applyBlogHeadersPlanLocally,
  verifyLocalHeadersApply,
} from "@/lib/overview/overview-blog-headers-apply-local";

describe("applyBlogHeadersPlanLocally", () => {
  it("replaces nth h2 inner text without changing body", () => {
    const html = "<p>Intro</p><h2>old heading</h2><p>Body copy stays.</p>";
    const { updatedHtml, finalH2s, replacements } = applyBlogHeadersPlanLocally(
      html,
      {
        h2Actions: [{ action: "optimize", index: 0, proposedText: "New Heading", rationale: "" }],
      },
      ["old heading"],
    );
    expect(replacements[0]?.ok).toBe(true);
    expect(finalH2s).toEqual(["New Heading"]);
    expect(updatedHtml).toContain("<h2>New Heading</h2>");
    expect(updatedHtml).toContain("<p>Body copy stays.</p>");
    expect(verifyLocalHeadersApply(html, updatedHtml)).toEqual({ ok: true });
  });

  it("replaces h2 with nested markup by index", () => {
    const html =
      '<p>Intro</p><h2 class="wp-block-heading"><strong>Income and Structure</strong></h2><p>Body</p>';
    const { updatedHtml, finalH2s, replacements } = applyBlogHeadersPlanLocally(
      html,
      {
        h2Actions: [
          {
            action: "optimize",
            index: 0,
            proposedText: "Understanding Holding Company Income and Structure",
            rationale: "",
          },
        ],
      },
      ["Income and Structure"],
    );
    expect(replacements[0]?.ok).toBe(true);
    expect(finalH2s[0]).toBe("Understanding Holding Company Income and Structure");
    expect(updatedHtml).toContain("Understanding Holding Company Income and Structure");
  });

  it("skips plan index with no matching h2 (no insert)", () => {
    const html = "<p>RRSP and TFSA body with no h2 tags.</p>";
    const { finalH2s, updatedHtml, replacements } = applyBlogHeadersPlanLocally(
      html,
      {
        h2Actions: [{ action: "optimize", index: 0, proposedText: "RRSP and TFSA Limits 2026", rationale: "" }],
      },
      [],
    );
    expect(replacements).toHaveLength(0);
    expect(finalH2s).toEqual([]);
    expect(updatedHtml).toBe(html);
  });

  it("replaces second h2 by index", () => {
    const html = "<h2>Title A</h2><p>x</p><h2>Title B</h2><p>y</p>";
    const { finalH2s } = applyBlogHeadersPlanLocally(
      html,
      {
        h2Actions: [{ action: "optimize", index: 1, proposedText: "Title B Updated", rationale: "" }],
      },
      ["Title A", "Title B"],
    );
    expect(finalH2s).toEqual(["Title A", "Title B Updated"]);
  });

  it("strips html from proposedText so extra h2 tags cannot be injected", () => {
    const html = "<h2>A</h2><p>x</p>";
    const { updatedHtml, finalH2s } = applyBlogHeadersPlanLocally(
      html,
      {
        h2Actions: [
          {
            action: "optimize",
            index: 0,
            proposedText: "B</h2><h2>Extra",
            rationale: "",
          },
        ],
      },
      ["A"],
    );
    expect(finalH2s).toEqual(["BExtra"]);
    expect(updatedHtml.match(/<h2/gi)?.length).toBe(1);
  });

  it("inserts leading h2 before first paragraph when missing", () => {
    const html =
      "<p>Intro paragraph.</p><p>Second.</p><h2>Mid Section</h2><p>Body</p>";
    const { updatedHtml, finalH2s, replacements } = applyBlogHeadersPlanLocally(
      html,
      {
        leadingH2: "Medical Bookkeeping for Healthcare Practices",
        h2Actions: [
          { action: "optimize", index: 0, proposedText: "KWB Medical Bookkeeping Advisory", rationale: "" },
        ],
      },
      ["Mid Section"],
      true,
    );
    expect(updatedHtml.indexOf("<h2>Medical Bookkeeping")).toBeLessThan(updatedHtml.indexOf("<p>"));
    expect(finalH2s[0]).toBe("Medical Bookkeeping for Healthcare Practices");
    expect(replacements[0]?.now).toBe("Medical Bookkeeping for Healthcare Practices");
  });
});
