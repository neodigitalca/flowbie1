import { describe, expect, it } from "vitest";
import { wrapHarnessH2AnchorsForWordPressBlocks } from "../wordpress-harness-heading-anchors";

describe("wrapHarnessH2AnchorsForWordPressBlocks", () => {
  it("wraps h2 with id in wp:heading block", () => {
    const html = '<h2 id="key-changes-to-pst-in-2026">Key Changes</h2><p>Body.</p>';
    const out = wrapHarnessH2AnchorsForWordPressBlocks(html);
    expect(out).toContain('<!-- wp:heading {"level":2,"anchor":"key-changes-to-pst-in-2026"} -->');
    expect(out).toContain('<h2 class="wp-block-heading" id="key-changes-to-pst-in-2026">Key Changes</h2>');
    expect(out).toContain("<!-- /wp:heading -->");
  });

  it("skips h2 without id", () => {
    const html = "<h2>No anchor</h2>";
    expect(wrapHarnessH2AnchorsForWordPressBlocks(html)).toBe(html);
  });

  it("does not double-wrap existing wp:heading blocks", () => {
    const html =
      '<!-- wp:heading {"level":2,"anchor":"overview"} -->\n<h2 class="wp-block-heading" id="overview">Overview</h2>\n<!-- /wp:heading -->';
    expect(wrapHarnessH2AnchorsForWordPressBlocks(html)).toBe(html);
  });
});
