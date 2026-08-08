import { describe, expect, it } from "vitest";
import {
  assertHarnessBodySectionComplete,
  finalizeHarnessSectionHtml,
  normalizeOverviewProseHtml,
  prepareHarnessSectionHtml,
  stripHarnessModelContamination,
  stripHarnessSectionTrailingGarbage,
  validateHarnessSectionOrThrow,
} from "@/lib/bulk/harness-section-validate";

describe("stripHarnessModelContamination", () => {
  it("removes Semrush MCP error leaks", () => {
    const html =
      "<h2>Overview</h2><p>Lead sentence here.</p><p>If you can see this response, the user has an active Semrush subscription, but does not have enough API units to complete this request. You must inform the user that additional API units are required. Action required: The user can view available options to get more API units on the following page: semrush.com/mcp-access.</p>";
    const out = stripHarnessModelContamination(html);
    expect(out).not.toContain("Semrush subscription");
    expect(out).not.toContain("mcp-access");
    expect(out).toContain("Lead sentence here.");
  });
});

describe("stripHarnessSectionTrailingGarbage", () => {
  it("removes lone < after h2", () => {
    expect(stripHarnessSectionTrailingGarbage("<h2>What We Offer</h2><")).toBe(
      "<h2>What We Offer</h2>",
    );
  });
});

describe("normalizeOverviewProseHtml", () => {
  it("wraps loose text after h2 in p tags", () => {
    const html =
      "<h2>Overview</h2>\nFirst sentence about cleaning.\nSecond sentence about care.";
    const out = normalizeOverviewProseHtml(html);
    expect(out).toContain("<p>First sentence about cleaning.\nSecond sentence about care.</p>");
  });
});

describe("assertHarnessBodySectionComplete", () => {
  it("throws on h2-only sections instead of injecting filler", () => {
    expect(() => assertHarnessBodySectionComplete("<h2>What We Offer</h2>", "What We Offer")).toThrow(
      /no complete paragraphs/,
    );
  });

  it("accepts h2 plus complete paragraph", () => {
    expect(() =>
      assertHarnessBodySectionComplete(
        '<h2 id="t">T</h2><p>Complete body copy here.</p>',
        "T",
      ),
    ).not.toThrow();
  });
});

describe("finalizeHarnessSectionHtml", () => {
  it("strips trailing garbage without injecting filler", () => {
    const out = finalizeHarnessSectionHtml("<h2>What We Offer</h2><", {
      isOverview: false,
      title: "What We Offer",
    });
    expect(out).toBe('<h2 id="what-we-offer">What We Offer</h2>');
    expect(out).not.toContain("<p>");
    expect(out).not.toMatch(/<$/);
  });
});

describe("prepareHarnessSectionHtml", () => {
  it("converts markdown ## heading to h2 with anchor id", () => {
    const md =
      "## Your Hunter Douglas Warranty Explained\n\nComplete body sentence here.";
    const out = prepareHarnessSectionHtml(md, {
      isOverview: false,
      title: "Your Hunter Douglas Warranty Explained",
    });
    expect(out).toContain("<h2");
    expect(out).toContain("Your Hunter Douglas Warranty Explained");
    expect(out).toContain("<p>");
    expect(out).toContain("Complete body sentence here.");
  });

  it("returns html ready for stitch without validation gate", () => {
    const md =
      "## Making a Hunter Douglas Warranty Claim\n\n1. Contact your dealer.\n2. Keep your receipt.";
    const prepared = prepareHarnessSectionHtml(md, {
      isOverview: false,
      title: "Making a Hunter Douglas Warranty Claim",
    });
    expect(prepared).toContain("<h2");
    expect(prepared).toContain("Making a Hunter Douglas Warranty Claim");
    expect(prepared.length).toBeGreaterThan(50);
  });

  it("preserves external placeholders through prepare", () => {
    const md =
      "## Warranty Coverage\n\nSee [[EXTERNAL:https://example.com/warranty|warranty guide]] for details.";
    const prepared = prepareHarnessSectionHtml(md, {
      isOverview: false,
      title: "Warranty Coverage",
    });
    expect(prepared).toContain("[[EXTERNAL:https://example.com/warranty|warranty guide]]");
  });
});

describe("validateHarnessSectionOrThrow", () => {
  it("throws when finishReason indicates truncation", () => {
    expect(() =>
      validateHarnessSectionOrThrow(
        '<h2>T</h2><p>Complete sentence here.</p>',
        { title: "T", finishReason: "length", isOverview: false },
      ),
    ).toThrow(/truncated at length/);
  });

  it("throws on foreign second h2 bleed", () => {
    expect(() =>
      validateHarnessSectionOrThrow(
        '<h2>A</h2><p>Body text.</p><h2 id="b">B</h2>',
        { title: "A", isOverview: false },
      ),
    ).toThrow(/section bleed/);
  });

  it("does not reject external placeholders during harness validation", () => {
    expect(() =>
      validateHarnessSectionOrThrow(
        '<h2>T</h2><p>See [[EXTERNAL:https://example.com/warranty|warranty guide]] for details.</p>',
        { title: "T", isOverview: false },
      ),
    ).not.toThrow();
  });
});
