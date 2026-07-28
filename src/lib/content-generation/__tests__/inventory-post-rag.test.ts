import { describe, expect, it } from "vitest";
import { buildInventoryPostRagContext } from "../inventory-post-rag";
import type { SitePostInventoryRow } from "@/lib/wordpress-api/types";

describe("buildInventoryPostRagContext", () => {
  it("includes title, keyword, and stripped body from inventory row", () => {
    const row: SitePostInventoryRow = {
      id: 99,
      slug: "provenance-woven-woods",
      url: "https://example.com/hunter-douglas/shades/provenance-woven-woods/",
      date_gmt: "",
      fields: {
        title: "Provenance Woven Wood Shades",
        keyword: "Provenance woven wood shades",
        meta: "Meta line",
        content: "<p>Real page copy about woven wood shades.</p>",
        excerpt: "",
      },
      acf: { keyword_focus: "Provenance woven wood shades" },
    };
    const rag = buildInventoryPostRagContext(row);
    expect(rag).toContain("Provenance Woven Wood Shades");
    expect(rag).toContain("Provenance woven wood shades");
    expect(rag).toContain("woven wood shades");
    expect(rag).not.toContain("PAGE SOURCE");
  });
});
