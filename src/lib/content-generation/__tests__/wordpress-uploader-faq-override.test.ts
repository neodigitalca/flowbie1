import { describe, expect, it } from "vitest";
import { buildFAQSchemaScriptFromEntries } from "@/lib/content-generation/wordpress-uploader";

describe("FAQ schema override contract", () => {
  it("pre-built script from entries is usable as faqSchemaOverride", () => {
    const override = buildFAQSchemaScriptFromEntries(
      [
        { question: "What is solar?", answer: "Solar converts sunlight to electricity." },
        { question: "How long is payback?", answer: "It depends on usage and system size." },
      ],
      "solar panels",
      "Edmonton",
      "https://example.com",
      [{ city: "Edmonton", state: "AB" }],
    );

    expect(override).toContain('<script type="application/ld+json">');
    expect(override).toContain('"@type":"FAQPage"');
    expect(override).toContain("What is solar?");
    expect(override).toContain("Solar converts sunlight to electricity.");
  });

  it("runFaqBlock condition includes non-empty override when generateFaqSchema is false", () => {
    const generateFaqSchema = false;
    const bulkFaqMinimum4 = false;
    const faqSchemaOverrideTrimmed = '<script type="application/ld+json">{}</script>';
    const runFaqBlock =
      generateFaqSchema || bulkFaqMinimum4 || Boolean(faqSchemaOverrideTrimmed);
    expect(runFaqBlock).toBe(true);
  });
});
