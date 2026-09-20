import { describe, expect, it } from "vitest";
import { resolveElementorTargetSectionId } from "@/lib/elementor-page-content/resolve-elementor-target-section-id";
import type { ElementorSectionHeader } from "@/lib/elementor-page-content/parse-elementor-section-outline";

const sections: ElementorSectionHeader[] = [
  {
    id: "abc123",
    title: "Fully Custom",
    hasHeadingWidget: true,
    headingInBodyHtml: false,
    headingHtml: "",
    depth: 0,
    bodyText: "",
    bodyHtml: "<p>Body one</p>",
  },
  {
    id: "def456",
    title: "Commercial Projects",
    hasHeadingWidget: true,
    headingInBodyHtml: false,
    headingHtml: "",
    depth: 0,
    bodyText: "",
    bodyHtml: "<p>Body two</p>",
  },
];

describe("resolveElementorTargetSectionId", () => {
  it("returns the id when it already matches Elementor JSON", () => {
    expect(resolveElementorTargetSectionId("abc123", sections)).toBe("abc123");
  });

  it("maps html-section-N to the band at the same index", () => {
    expect(resolveElementorTargetSectionId("html-section-1", sections)).toBe("def456");
  });

  it("maps cached-h2-N to the band at the same index", () => {
    expect(resolveElementorTargetSectionId("cached-h2-0", sections)).toBe("abc123");
  });

  it("falls back to a unique title match", () => {
    expect(
      resolveElementorTargetSectionId("missing-id", sections, {
        sectionTitle: "Commercial Projects",
      }),
    ).toBe("def456");
  });
});
