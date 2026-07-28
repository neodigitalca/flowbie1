import { describe, expect, it } from "vitest";
import { faqPlainTextForWpStorage, parseFaqEntries } from "@/lib/faq-entries";

describe("faqPlainTextForWpStorage", () => {
  it("converts JSON-LD script wrapper to plain FAQ blocks", () => {
    const jsonLd = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is X?","acceptedAnswer":{"@type":"Answer","text":"It is Y."}}]}</script>`;
    const plain = faqPlainTextForWpStorage(jsonLd);
    expect(plain).not.toMatch(/<script/i);
    expect(plain).toContain("What is X?");
    expect(plain).toContain("It is Y.");
    expect(plain).not.toMatch(/^Q:/m);
    expect(parseFaqEntries(plain)).toHaveLength(1);
  });

  it("strips Q:/A: labels to plain FAQ blocks", () => {
    const raw = "Q: First?\nA: Yes.\nQ: Second?\nA: Also yes.";
    const plain = faqPlainTextForWpStorage(raw);
    expect(plain).not.toMatch(/^Q:/m);
    expect(plain).not.toMatch(/^A:/m);
    expect(plain).toContain("First?");
    expect(plain).toContain("Yes.");
    expect(parseFaqEntries(plain)).toHaveLength(2);
  });

  it("splits run-on FAQ text at question-led boundaries", () => {
    const raw =
      "What exactly is the Goods and Services Tax (GST) applied to new construction homes in Canada?The Goods and Services Tax (GST) is a federal tax in Canada that typically applies to the purchase of newly constructed homes. What factors determine if a new home purchase in Canada is subject to GST?Generally, a new home purchase in Canada is subject to GST if it's a brand-new build. What GST rebates are available for new home buyers in Canada?The Canadian government offers a GST/HST new housing rebate.";
    const entries = parseFaqEntries(raw);
    expect(entries).toHaveLength(3);
    expect(entries[0]?.question).toMatch(/GST.*Canada\?$/);
    expect(entries[0]?.answer).toMatch(/^The Goods and Services Tax/);
    expect(entries[1]?.question).toMatch(/subject to GST\?$/);
    expect(entries[2]?.question).toMatch(/new home buyers in Canada\?$/);
  });
});
