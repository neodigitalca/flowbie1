import { describe, expect, it } from "vitest";
import {
  appendFaqSectionToPostHtml,
  buildFaqSectionHtml,
  FLO_FAQ_CLASS,
  HARNESS_FAQ_ANCHOR_ID,
  resolveFaqSourceHtml,
  stripTrailingFaqSection,
} from "@/lib/overview/overview-blog-faq-append";
import { normalizeFaqIntroPlainText } from "@/lib/overview/overview-blog-faq-intro-agent";

describe("buildFaqSectionHtml", () => {
  it("wraps H2 FAQ, intro, and Q&A table in flo-faq", () => {
    const html = buildFaqSectionHtml(
      [
        { question: "What is X?", answer: "X is a product." },
        { question: "How does Y work?", answer: "Y works simply." },
      ],
      "Common questions about solar panels.",
    );
    expect(html).toContain(`<div class="${FLO_FAQ_CLASS}">`);
    expect(html).toContain(`</div>`);
    expect(html).toContain(`<h2 id="${HARNESS_FAQ_ANCHOR_ID}">FAQ</h2>`);
    expect(html).toContain("<p>Common questions about solar panels.</p>");
    expect(html).toContain(">Question</th>");
    expect(html).toContain(">Answer</th>");
    expect(html).toContain(">What is X?</td>");
    expect(html).toContain(">X is a product.</td>");
    expect(html).toContain(">How does Y work?</td>");
    expect(html).toContain(">Y works simply.</td>");
  });

  it("escapes HTML in question, answer, and intro", () => {
    const html = buildFaqSectionHtml(
      [{ question: "Is <script> bad?", answer: 'Use & "quotes".' }],
      'About <b>cost</b> & "price".',
    );
    expect(html).toContain(">Is &lt;script&gt; bad?</td>");
    expect(html).toContain(">Use &amp; &quot;quotes&quot;.</td>");
    expect(html).toContain("<p>About &lt;b&gt;cost&lt;/b&gt; &amp; &quot;price&quot;.</p>");
    expect(html).not.toContain("<script>");
  });

  it("copies backend question and answer fields into table cells without Q:/A: stripping", () => {
    const longAnswer =
      "The primary goals of the 2026 Alberta physician privatization changes are to modernize funding models, improve patient access, and support practice sustainability across the province.";
    const html = buildFaqSectionHtml(
      [
        {
          question: "What are the main goals of the 2026 Alberta physician privatization changes?",
          answer: longAnswer,
        },
        {
          question: "What steps should physicians take to navigate the new regulatory environment in Alberta?",
          answer:
            "Physicians should monitor government announcements, review billing updates, and engage expert advisors before adjusting practice operations.",
        },
      ],
      "Common questions about Alberta physician privatization.",
    );
    expect(html).toContain(
      ">What are the main goals of the 2026 Alberta physician privatization changes?</td>",
    );
    expect(html).toContain(`>${longAnswer}</td>`);
    expect(html).toContain(
      ">Physicians should monitor government announcements, review billing updates, and engage expert advisors before adjusting practice operations.</td>",
    );
    expect(html).not.toContain(">The primary goals</td>");
    expect(html).not.toContain(">Physicians</td>");
  });

  it("returns empty when intro or questions are missing", () => {
    expect(buildFaqSectionHtml([{ question: "Ok?", answer: "Yes." }], "")).toBe("");
    expect(buildFaqSectionHtml([{ question: "  ", answer: "nope" }], "Intro.")).toBe("");
  });
});

describe("normalizeFaqIntroPlainText", () => {
  it("strips HTML and wrapping quotes", () => {
    expect(normalizeFaqIntroPlainText('  "Common questions about cost."  ')).toBe(
      "Common questions about cost.",
    );
    expect(normalizeFaqIntroPlainText("<p>Common questions about blinds.</p>")).toBe(
      "Common questions about blinds.",
    );
  });
});

describe("stripTrailingFaqSection", () => {
  it("removes flo-faq wrapper and FAQ H2 through end when it is last", () => {
    const html = [
      `<h2>Cost</h2><p>Body</p>`,
      `<div class="flo-faq"><h2 id="faq">FAQ</h2><p>Intro</p><table><tbody><tr><td>Q</td><td>A</td></tr></tbody></table></div>`,
    ].join("");
    const out = stripTrailingFaqSection(html);
    expect(out).toContain("Cost");
    expect(out).toContain("Body");
    expect(out.toLowerCase()).not.toContain(">faq<");
    expect(out).not.toContain("flo-faq");
    expect(out).not.toContain("<table>");
  });

  it("removes Frequently Asked Questions by title", () => {
    const html = `<h2>Body</h2><p>x</p><h2>Frequently Asked Questions</h2><p>old</p><table></table>`;
    const out = stripTrailingFaqSection(html);
    expect(out).toBe(`<h2>Body</h2><p>x</p>`);
  });

  it("removes Answering Your Questions body section", () => {
    const html = [
      `<h2 id="selecting">Selecting the Right System</h2><p>Body</p>`,
      `<h2 id="questions">Answering Your Questions on Window Coverings</h2>`,
      `<p>Customers often have questions.</p>`,
      `<table><thead><tr><th>Question</th><th>Answer</th></tr></thead><tbody><tr><td>Q?</td><td>A.</td></tr></tbody></table>`,
      `<h2 id="find">Find the Right Operating System</h2><p>Close</p>`,
    ].join("");
    const out = stripTrailingFaqSection(html);
    expect(out).toContain("Selecting the Right System");
    expect(out).toContain("Find the Right Operating System");
    expect(out).not.toContain("Answering Your Questions");
    expect(out).not.toMatch(/<th>Question<\/th>/);
  });
});

describe("appendFaqSectionToPostHtml", () => {
  it("appends FAQ after body and does not nest flo-faq on re-append", () => {
    const body = `<h2>Intro</h2><p>Lead</p>`;
    const entries = [{ question: "What is X?", answer: "X." }];
    const first = appendFaqSectionToPostHtml({
      sourceHtml: body,
      entries,
      introParagraph:
        "These are common questions about X and how the topic applies to your situation.",
    });
    expect(first).not.toBeNull();
    expect(first!.html).toContain("Intro");
    expect(first!.html).toContain(`class="${FLO_FAQ_CLASS}"`);
    expect(first!.html).toContain(`id="${HARNESS_FAQ_ANCHOR_ID}"`);
    expect(first!.faqSectionHtml).toContain("What is X?");

    const second = appendFaqSectionToPostHtml({
      sourceHtml: first!.html,
      entries: [{ question: "What is Y?", answer: "Y." }],
      introParagraph:
        "These are common questions about Y and how the topic applies to your situation.",
    });
    expect(second).not.toBeNull();
    expect(second!.html).toContain("What is Y?");
    expect(second!.html).not.toContain("What is X?");
    const wrapperCount = second!.html.split(`class="${FLO_FAQ_CLASS}"`).length - 1;
    expect(wrapperCount).toBe(1);
    const faqCount = second!.html.toLowerCase().split(">faq<").length - 1;
    expect(faqCount).toBe(1);
  });

  it("returns null when source HTML is empty", () => {
    expect(
      appendFaqSectionToPostHtml({
        sourceHtml: "",
        entries: [{ question: "Q?", answer: "A." }],
        introParagraph: "Intro.",
      }),
    ).toBeNull();
  });

  it("throws when intro is empty", () => {
    expect(() =>
      appendFaqSectionToPostHtml({
        sourceHtml: `<h2>Body</h2>`,
        entries: [{ question: "Q?", answer: "A." }],
        introParagraph: "  ",
      }),
    ).toThrow("FAQ intro failed quality validation");
  });
});

describe("resolveFaqSourceHtml", () => {
  it("prefers postContentOptimized over postContent", () => {
    expect(
      resolveFaqSourceHtml({
        postContentOptimized: "<p>opt</p>",
        postContent: "<p>raw</p>",
      }),
    ).toBe("<p>opt</p>");
    expect(resolveFaqSourceHtml({ postContent: "<p>raw</p>" })).toBe("<p>raw</p>");
    expect(resolveFaqSourceHtml({})).toBe("");
  });
});
