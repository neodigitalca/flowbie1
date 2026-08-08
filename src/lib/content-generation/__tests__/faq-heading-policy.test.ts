import { describe, expect, it } from "vitest";
import {
  filterOutFaqStyleHeadingTitles,
  isFaqStyleHeadingTitle,
} from "@/lib/content-generation/faq-heading-policy";

describe("isFaqStyleHeadingTitle", () => {
  it("matches literal FAQ headings", () => {
    expect(isFaqStyleHeadingTitle("FAQ")).toBe(true);
    expect(isFaqStyleHeadingTitle("Frequently Asked Questions")).toBe(true);
  });

  it("matches synthesized FAQ-style titles", () => {
    expect(isFaqStyleHeadingTitle("Answering Your Questions on Window Coverings")).toBe(true);
    expect(isFaqStyleHeadingTitle("Common Questions About Blinds")).toBe(true);
    expect(isFaqStyleHeadingTitle("Your Questions Answered")).toBe(true);
    expect(isFaqStyleHeadingTitle("Q&A About Window Treatments")).toBe(true);
  });

  it("does not match normal topic H2s", () => {
    expect(isFaqStyleHeadingTitle("Motorized and Smart Options")).toBe(false);
    expect(isFaqStyleHeadingTitle("Choosing Window Covering Operating Systems")).toBe(false);
    expect(isFaqStyleHeadingTitle("Overview")).toBe(false);
  });

  it("filterOutFaqStyleHeadingTitles removes FAQ-style only", () => {
    const out = filterOutFaqStyleHeadingTitles([
      "Manual and Cordless Systems",
      "Answering Your Questions on Window Coverings",
      "FAQ",
    ]);
    expect(out).toEqual(["Manual and Cordless Systems"]);
  });
});
