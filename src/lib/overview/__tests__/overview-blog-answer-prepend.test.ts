import { describe, expect, it, vi, beforeEach } from "vitest";
import { HARNESS_ANSWER_ANCHOR_ID } from "@/lib/bulk/blog-harness-answer-agent";
import { stitchHarnessSections } from "@/lib/bulk/bulk-harness-outline";
import {
  extractAnswerSectionHtml,
  generateAnswerSectionHtml,
  generateAndPrependOverviewHtml,
  stripLeadingAnswerSection,
} from "@/lib/overview/overview-blog-overview-prepend";

vi.mock("@/lib/competitor-research/competitor-report-openrouter", () => ({
  callOpenRouterChatCompletion: vi.fn(),
}));

import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";

beforeEach(() => {
  vi.mocked(callOpenRouterChatCompletion).mockReset();
});

describe("generateAnswerSectionHtml entity prompts", () => {
  it("passes place entity into OpenRouter user and system prompts for SAP pages", async () => {
    vi.mocked(callOpenRouterChatCompletion).mockResolvedValueOnce({
      content: `<h2>Answer</h2><p>One. Two.</p>`,
    });

    await generateAnswerSectionHtml({
      apiKey: "test-key",
      articleTitle: "Plumbing Edmonton",
      focusKeyword: "plumbing edmonton",
      bodyH2Titles: ["Services"],
      pageKind: "entity",
      entity: "Edmonton, AB",
      connectedSite: { name: "Acme Plumbing", siteUrl: "https://example.com" },
    });

    expect(callOpenRouterChatCompletion).toHaveBeenCalledTimes(1);
    const call = vi.mocked(callOpenRouterChatCompletion).mock.calls[0]![0];
    expect(call.system).toContain("Edmonton, AB");
    expect(call.user).toContain("Edmonton, AB");
    expect(call.user).toContain("service-area entity");
  });
});

describe("extractAnswerSectionHtml", () => {
  it("returns Answer H2 block through the next H2", () => {
    const html = [
      `<h2 id="answer">Answer</h2>`,
      `<p>Direct answer one. Direct answer two.</p>`,
      `<h2 id="overview">Overview</h2>`,
      `<p>Lead</p>`,
    ].join("");
    const out = extractAnswerSectionHtml(html);
    expect(out).toContain(`id="${HARNESS_ANSWER_ANCHOR_ID}"`);
    expect(out).toContain("Direct answer one");
    expect(out).not.toContain("Overview");
  });
});

describe("generateAndPrependOverviewHtml", () => {
  it("throws when Answer HTML is empty", async () => {
    vi.mocked(callOpenRouterChatCompletion).mockResolvedValueOnce({
      content: "",
    });

    await expect(
      generateAndPrependOverviewHtml({
        sourceHtml: `<h2>Cost Factors</h2><p>Body</p>`,
        articleTitle: "Plumbing Edmonton",
        focusKeyword: "plumbing edmonton",
        apiKey: "test-key",
        connectedSite: { name: "Acme Plumbing", siteUrl: "https://example.com" },
      }),
    ).rejects.toThrow(/Answer agent returned empty HTML/);
  });
});

describe("answer-only prepend stitch", () => {
  it("preserves Overview when replacing Answer", () => {
    const body = [
      `<h2 id="answer">Answer</h2><p>Old answer.</p>`,
      `<div class="flo-overview"><h2 id="overview">Overview</h2><p>Lead</p></div>`,
      `<h2>Cost Factors</h2><p>Body</p>`,
    ].join("");
    const stripped = stripLeadingAnswerSection(body);
    expect(stripped).not.toContain("Old answer");
    expect(stripped).toContain("Overview");
    expect(stripped).toContain("Cost Factors");

    const newAnswer = `<h2 id="answer">Answer</h2><p>New answer one. New answer two.</p>`;
    const stitched = stitchHarnessSections([newAnswer, stripped]);
    const answerPos = stitched.indexOf(`id="${HARNESS_ANSWER_ANCHOR_ID}"`);
    const overviewPos = stitched.indexOf('id="overview"');
    expect(answerPos).toBeGreaterThanOrEqual(0);
    expect(overviewPos).toBeGreaterThan(answerPos);
    expect(stitched).toContain("New answer one");
    expect(stitched).toContain("Cost Factors");
  });
});
