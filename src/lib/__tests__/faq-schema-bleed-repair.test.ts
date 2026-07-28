import { describe, expect, it } from "vitest";
import {
  faqEntriesHaveBleed,
  parseFaqEntries,
  parseQaLabeledBlocks,
  repairFaqEntriesFromSchema,
} from "@/lib/faq-entries";
import {
  buildFaqSectionHtml,
  FLO_FAQ_CLASS,
} from "@/lib/overview/overview-blog-faq-append";

/** Exact corrupted ACF schema from production bleed (answer text split into next question name). */
const CORRUPTED_ALBERTA_FAQ_SCHEMA = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What are the 2026 Alberta Physician Privatization Changes?","acceptedAnswer":{"@type":"Answer","text":"A: These changes represent a significant shift in Alberta's healthcare landscape, impacting"}},{"@type":"Question","name":"how physicians practice and manage their operations. They introduce new operational frameworks and financial considerations, necessitating a proactive approach to understanding and adapting to the evolving environment. Being informed is crucial for making strategic decisions about your practice and personal financial future. Q: How will the 2026 Alberta Physician Privatization Changes affect practice operations?","acceptedAnswer":{"@type":"Answer","text":"A: The changes"}},{"@type":"Question","name":"will introduce significant operational shifts, impacting administrative processes, patient care models, and overall business structures. This includes adjustments to billing, record-keeping, and potentially the scope of services offered. Practices may need to evaluate existing workflows and consider new business structures to ensure compliance and efficiency. Q: What are the key financial implications for Alberta physicians due to the 2026 changes?","acceptedAnswer":{"@type":"Answer","text":"A: Physicians"}},{"@type":"Question","name":"should anticipate significant financial implications, including potential shifts in income streams, adjustments to operational expenses, and a need to reassess investment strategies. Detailed attention to personal tax returns and business year-end reporting will become more critical. Physicians should also consider the broader impact on their overall wealth transfer planning. Q: What steps should Alberta physicians take to prepare for the 2026 privatization changes?","acceptedAnswer":{"@type":"Answer","text":"A: Physicians"}}]}</script>`;

describe("parseFaqEntries Q:/A: labels before word-lead run-on", () => {
  it("parses multiline Q:/A: LLM output without splitting mid-answer how/what", () => {
    const raw = `Q: What are the 2026 Alberta Physician Privatization Changes?
A: These changes represent a significant shift in Alberta's healthcare landscape, impacting how physicians practice and manage their operations. They introduce new operational frameworks and financial considerations.
Q: How will the 2026 Alberta Physician Privatization Changes affect practice operations?
A: The changes will introduce significant operational shifts, impacting administrative processes, patient care models, and overall business structures.
Q: What are the key financial implications for Alberta physicians due to the 2026 changes?
A: Physicians should anticipate significant financial implications, including potential shifts in income streams.
Q: What steps should Alberta physicians take to prepare for the 2026 privatization changes?
A: Physicians should review regulatory updates, consult advisors, and update practice workflows before 2026.`;

    const entries = parseFaqEntries(raw);
    expect(entries).toHaveLength(4);
    expect(entries[0]!.question).toBe("What are the 2026 Alberta Physician Privatization Changes?");
    expect(entries[0]!.answer).toContain("impacting how physicians practice");
    expect(entries[0]!.answer).toContain("operational frameworks");
    expect(entries[1]!.question).toMatch(/^How will the 2026/);
    expect(entries[1]!.answer).toContain("significant operational shifts");
    expect(entries.every((e) => !e.question.startsWith("how physicians"))).toBe(true);
  });

  it("does not split an answer that contains lowercase how physicians mid-sentence", () => {
    const raw = `Q: What is changing?
A: These changes represent a significant shift impacting how physicians practice and manage their operations across Alberta.`;
    const entries = parseFaqEntries(raw);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.answer).toContain("how physicians practice");
  });
});

describe("repairFaqEntriesFromSchema / bled FAQPage", () => {
  it("detects bleed when next question name starts lowercase or embeds Q:", () => {
    const bled = parseFaqEntries(CORRUPTED_ALBERTA_FAQ_SCHEMA);
    // parseFaqEntries already repairs; detect on raw extract shape:
    const rawBleed = [
      {
        question: "What are the 2026 Alberta Physician Privatization Changes?",
        answer: "A: These changes represent a significant shift in Alberta's healthcare landscape, impacting",
      },
      {
        question:
          "how physicians practice and manage their operations. Q: How will the 2026 Alberta Physician Privatization Changes affect practice operations?",
        answer: "A: The changes",
      },
    ];
    expect(faqEntriesHaveBleed(rawBleed)).toBe(true);
    expect(bled.length).toBeGreaterThanOrEqual(2);
    expect(bled[0]!.question).toBe("What are the 2026 Alberta Physician Privatization Changes?");
    expect(bled[0]!.answer.toLowerCase()).toContain("how physicians practice");
    expect(bled.some((e) => e.question.trim().startsWith("how physicians"))).toBe(false);
  });

  it("repairs the exact corrupted Alberta schema into clean pairs with full answers", () => {
    const entries = parseFaqEntries(CORRUPTED_ALBERTA_FAQ_SCHEMA);
    expect(entries.length).toBe(4);
    expect(entries[0]!.answer.length).toBeGreaterThan(80);
    expect(entries[0]!.answer).toContain("how physicians practice");
    expect(entries[1]!.question).toMatch(/How will the 2026 Alberta Physician Privatization Changes affect practice operations\?/i);
    expect(entries[1]!.answer.length).toBeGreaterThan(40);
    expect(entries[1]!.answer).toContain("operational shifts");
    expect(entries[2]!.question).toMatch(/financial implications/i);
    expect(entries[2]!.answer.length).toBeGreaterThan(40);
    expect(entries[3]!.question).toMatch(/steps should Alberta physicians take/i);
    expect(entries.every((e) => !/^A:/i.test(e.answer))).toBe(true);
  });
});

describe("buildFaqSectionHtml pastes repaired schema fields", () => {
  it("puts full repaired answers in the Answer column", () => {
    const entries = parseFaqEntries(CORRUPTED_ALBERTA_FAQ_SCHEMA);
    const html = buildFaqSectionHtml(
      entries,
      "Common questions about the 2026 Alberta physician privatization changes.",
    );
    expect(html).toContain(`class="${FLO_FAQ_CLASS}"`);
    expect(html).toContain(">What are the 2026 Alberta Physician Privatization Changes?</td>");
    expect(html).toContain("how physicians practice and manage their operations");
    expect(html).not.toContain(">The changes</td>");
    expect(html).not.toContain(">A: Physicians</td>");
    expect(html).not.toContain(">how physicians practice");
  });
});

describe("parseQaLabeledBlocks", () => {
  it("parses inline Q:/A: tokens in one line", () => {
    const entries = parseQaLabeledBlocks(
      "Q: First question? A: First answer with how physicians work. Q: Second question? A: Second answer.",
    );
    expect(entries).toHaveLength(2);
    expect(entries[0]!.answer).toContain("how physicians work");
    expect(entries[1]!.question).toBe("Second question?");
  });
});

describe("repairFaqEntriesFromSchema no-op when clean", () => {
  it("returns stripped clean pairs unchanged in structure", () => {
    const clean = [
      { question: "What is X?", answer: "X is a product that helps how physicians plan." },
      { question: "How does Y work?", answer: "Y works simply." },
    ];
    expect(faqEntriesHaveBleed(clean)).toBe(false);
    const out = repairFaqEntriesFromSchema(clean);
    expect(out).toHaveLength(2);
    expect(out[0]!.answer).toContain("how physicians plan");
  });
});
