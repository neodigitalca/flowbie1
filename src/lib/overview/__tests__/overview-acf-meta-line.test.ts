import { describe, expect, it } from "vitest";
import { acfMetaDescriptionLine } from "../overview-acf-meta-line";

describe("acfMetaDescriptionLine", () => {
  it("reads meta_description fields only, not prompt_modifier", () => {
    expect(
      acfMetaDescriptionLine({
        prompt_modifier: "from prompt",
        meta_description: "from meta",
      }),
    ).toBe("from meta");
    expect(acfMetaDescriptionLine({ prompt_modifier: "from prompt" })).toBe("");
    expect(acfMetaDescriptionLine({ seo_meta_description: "seo meta" })).toBe("seo meta");
  });
});
