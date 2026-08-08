import { describe, expect, it } from "vitest";
import {
  plainTextEndsWithCompleteSentence,
  trimHarnessSectionToCompleteSentences,
} from "@/lib/bulk/harness-section-complete-sentences";

describe("plainTextEndsWithCompleteSentence", () => {
  it("accepts terminal punctuation", () => {
    expect(plainTextEndsWithCompleteSentence("Done.")).toBe(true);
    expect(plainTextEndsWithCompleteSentence('He said "yes."')).toBe(true);
  });

  it("rejects mid-sentence cuts", () => {
    expect(plainTextEndsWithCompleteSentence("offering personalized cleaning")).toBe(false);
  });
});

describe("trimHarnessSectionToCompleteSentences", () => {
  it("leaves complete sections unchanged", () => {
    const html =
      '<h2>Title</h2><p>First complete sentence.</p><p>Second complete sentence.</p>';
    expect(trimHarnessSectionToCompleteSentences(html)).toBe(html);
  });

  it("removes a trailing paragraph cut mid-sentence", () => {
    const html =
      '<h2>Expert Dental Cleaning</h2><p>Plaque removal prevents gum disease near Saddleback Road.</p><p>Our team specializes in serving residents near Saddleback Road, Edmonton, offering personalized cleaning';
    expect(trimHarnessSectionToCompleteSentences(html)).toBe(
      '<h2>Expert Dental Cleaning</h2><p>Plaque removal prevents gum disease near Saddleback Road.</p>',
    );
  });

  it("removes an unclosed trailing p tag", () => {
    const html = "<h2>T</h2><p>Complete.</p><p>Still writing";
    expect(trimHarnessSectionToCompleteSentences(html)).toBe("<h2>T</h2><p>Complete.</p>");
  });
});
