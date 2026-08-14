import { describe, expect, it } from "vitest";
import { getMetaAdInstagramBestPractices } from "@/lib/ppc/load-meta-ad-instagram-best-practices";

describe("meta-ad-instagram-best-practices markdown", () => {
  it("loads brief-led rules without forbidden or agency stack language", () => {
    const markdown = getMetaAdInstagramBestPractices();
    expect(markdown).toContain("designed Instagram feed");
    expect(markdown).toContain("visualToolPalette");
    expect(markdown).not.toMatch(/Forbidden on image/i);
    expect(markdown).not.toMatch(/Agency stack/i);
    expect(markdown).not.toMatch(/Reject/i);
    expect(markdown).not.toMatch(/Elementor editor on laptop/i);
    expect(markdown).not.toMatch(/no digital props/i);
  });
});
