import { describe, expect, it } from "vitest";
import { paragraphBlocksForLinkAdds } from "@/lib/overview/overview-blog-links-extract";

describe("paragraphBlocksForLinkAdds", () => {
  it("skips headings — only p blocks are add targets", () => {
    const html = `
<h2>Tax planning overview</h2>
<p>Plain paragraph one.</p>
<p>Linked paragraph with <a href="/consultation/">book</a> here.</p>
`;
    const blocks = paragraphBlocksForLinkAdds(html);
    expect(blocks.map((b) => b.text)).toEqual(["Plain paragraph one."]);
    expect(blocks[0]?.index).toBe(0);
  });

  it("skips paragraphs that already contain links", () => {
    const html = `
<p>Plain paragraph one.</p>
<p>Linked paragraph with <a href="/services/">services</a> here.</p>
<p>Plain paragraph two.</p>
`;
    const blocks = paragraphBlocksForLinkAdds(html);
    expect(blocks.map((b) => b.text)).toEqual(["Plain paragraph one.", "Plain paragraph two."]);
    expect(blocks[0]?.index).toBe(0);
    expect(blocks[1]?.index).toBe(2);
  });
});
