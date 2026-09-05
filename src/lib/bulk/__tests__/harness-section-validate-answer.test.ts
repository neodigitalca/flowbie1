import { describe, expect, it } from "vitest";
import {
  assertHarnessAnswerProseComplete,
  assertStitchedHarnessArticle,
  countPlainTextSentences,
  finalizeHarnessSectionHtml,
  prepareHarnessSectionHtml,
  validateHarnessSectionOrThrow,
} from "@/lib/bulk/harness-section-validate";
import { HARNESS_ANSWER_ANCHOR_ID } from "@/lib/bulk/blog-harness-answer-agent";

describe("countPlainTextSentences", () => {
  it("counts two sentences in plain text", () => {
    expect(countPlainTextSentences("First sentence here. Second sentence ends.")).toBe(2);
  });
});

describe("Answer harness validation", () => {
  const validAnswer =
    `<h2>Answer</h2><p>Solar panels cost depends on system size. We see most Edmonton installs land in a mid five-figure range.</p>`;

  it("accepts exactly two sentences in one paragraph", () => {
    expect(() => assertHarnessAnswerProseComplete(validAnswer)).not.toThrow();
    validateHarnessSectionOrThrow(validAnswer, {
      title: "Answer",
      isOverview: false,
      isAnswer: true,
    });
  });

  it("rejects three sentences", () => {
    const html = `<h2>Answer</h2><p>One. Two. Three.</p>`;
    expect(() => assertHarnessAnswerProseComplete(html)).toThrow(/exactly two sentences/);
  });

  it("rejects lists in Answer body", () => {
    const html = `<h2>Answer</h2><ul><li>No</li></ul>`;
    expect(() => assertHarnessAnswerProseComplete(html)).toThrow(/lists or tables/);
  });

  it("finalize injects answer anchor id", () => {
    const out = finalizeHarnessSectionHtml(validAnswer, {
      title: "Answer",
      isOverview: false,
      isAnswer: true,
    });
    expect(out).toContain(`id="${HARNESS_ANSWER_ANCHOR_ID}"`);
    expect(out).toContain(">Answer<");
  });

  it("prepareHarnessSectionHtml normalizes Answer markdown fence", () => {
    const out = prepareHarnessSectionHtml(
      "```html\n<h2>Answer</h2><p>Direct answer one. Field observation two.</p>\n```",
      { title: "Answer", isOverview: false, isAnswer: true },
    );
    expect(out).toContain(`id="${HARNESS_ANSWER_ANCHOR_ID}"`);
  });
});

describe("assertStitchedHarnessArticle", () => {
  it("throws when Answer H2 is missing", () => {
    const html = `<h2 id="overview">Overview</h2><p>Lead</p><h2>Cost</h2><p>Body</p>`;
    expect(() =>
      assertStitchedHarnessArticle(html, { requireIllustrative: false }),
    ).toThrow(/Answer section missing/);
  });

  it("throws when illustrative scenario is missing", () => {
    const html = `<h2 id="answer">Answer</h2><p>One. Two.</p><h2 id="overview">Overview</h2><p>Lead</p>`;
    expect(() =>
      assertStitchedHarnessArticle(html, { requireIllustrative: true }),
    ).toThrow(/ILLUSTRATIVE/);
  });
});
