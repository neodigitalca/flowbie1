import { describe, expect, it } from "vitest";
import { unwrapDuplicateInternalLinks } from "@/lib/overview/overview-blog-links-extract";

const SITE = "https://kwbllp.com";

describe("unwrapDuplicateInternalLinks", () => {
  it("unwraps second link to same destination, keeps first", () => {
    const html = `
<p><a href="${SITE}/blog/a/">first</a> and <a href="${SITE}/blog/a/">second</a></p>
<p><a href="${SITE}/consultation/">book</a></p>
`;
    const { html: out, dupesRemoved } = unwrapDuplicateInternalLinks(html, SITE);
    expect(dupesRemoved).toBe(1);
    expect(out).toContain(`<a href="${SITE}/blog/a/">first</a>`);
    expect(out).toContain("first</a> and second");
    expect(out).not.toContain(">second</a>");
    expect(out).toContain(`${SITE}/consultation/`);
  });
});
