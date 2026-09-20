import { describe, expect, it } from "vitest";
import {
  BLOG_GENERATOR_SECTION_DEFS,
  getBlogGeneratorSectionMeta,
} from "@/components/blog-generator/blog-generator-sections";

describe("blog-generator-sections", () => {
  it("registers Entity before Competitor (no standalone Pages generator)", () => {
    const ids = BLOG_GENERATOR_SECTION_DEFS.map((def) => def.id);
    expect(ids).not.toContain("pages");
    expect(ids.indexOf("competitor")).toBe(ids.indexOf("entity") + 1);
    expect(getBlogGeneratorSectionMeta("entity").label).toBe("Entity");
  });
});
