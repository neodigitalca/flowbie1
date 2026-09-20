import { describe, expect, it, vi, beforeEach } from "vitest";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
import { appendFaqSectionToPostHtml } from "@/lib/overview/overview-blog-faq-append";
import { finishFaqRowHarness } from "@/lib/overview/overview-faq-harness-mutations";
import { buildOverviewBulkSeoItem } from "@/lib/overview/overview-bulk-seo-payload";
import { createEmptyOverviewRow } from "@/lib/overview/overview-row-helpers";
import { pickBestFaqSourceHtml } from "@/lib/overview/overview-faq-source-html";

const getWordPressPostContent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/wordpress-api/posts", () => ({
  getWordPressPostContent,
}));

describe("FAQ source resolution", () => {
  beforeEach(() => {
    getWordPressPostContent.mockReset();
  });

  it("uses live WordPress body when cache is answer-only", async () => {
    const cached = `<h2 id="answer">Answer</h2><p>Short answer.</p>`;
    const live = `<h2>Overview</h2><p>${"Full blog paragraph. ".repeat(40)}</p>`;
    getWordPressPostContent.mockResolvedValue({ posts: [{ id: 9, content: live }] });
    const merged = pickBestFaqSourceHtml(cached, live);
    expect(merged).toContain("Full blog paragraph.");
    expect(merged.length).toBeGreaterThan(cached.length);
  });
});

describe("appendFaqSectionToPostHtml full body", () => {
  it("keeps article body before flo-faq at the end", () => {
    const article = "<h2>Cost factors</h2><p>Full CRA article body.</p>";
    const appended = appendFaqSectionToPostHtml({
      sourceHtml: article,
      entries: [{ question: "Q1?", answer: "A1." }],
      introParagraph: "Common questions about CRA mail-in policy for Edmonton readers.",
    });
    expect(appended).not.toBeNull();
    expect(appended!.html.indexOf("Cost factors")).toBeLessThan(appended!.html.indexOf("flo-faq"));
    expect(appended!.html).toContain("Full CRA article body.");
  });
});

describe("finishFaqRowHarness generated files", () => {
  it("writes faq.json and content html for the same post body", () => {
    const url = "https://example.com/cra-mail-in/";
    const postHtml =
      "<h2>Article</h2><p>Body</p><div class=\"flo-faq\"><h2 id=\"faq\">FAQ</h2></div>";
    let store: Record<string, BulkOptimizationState> = {
      "site-1-batch": {
        urls: [url],
        currentIndex: 0,
        urlStatuses: {},
        currentStep: "AI FAQs",
        runKind: "aiFaq",
        urlGeneratedFiles: {},
      },
    };

    finishFaqRowHarness(
      url,
      0,
      [{ question: "Q?", answer: "A." }],
      {
        siteId: "site-1",
        batchKey: "site-1-batch",
        setBulkOptimizationState: (updater) => {
          store = typeof updater === "function" ? updater(store) : updater;
        },
        setOptimizationProgress: () => undefined,
      },
      undefined,
      vi.fn(),
      { postHtml },
    );

    const files = store["site-1-batch"]?.urlGeneratedFiles?.[url] ?? [];
    expect(files.map((file) => file.name)).toEqual(["faq.json", "content-cra-mail-in.html"]);
    expect(files.find((file) => file.name === "faq.json")?.content).toContain("Q?");
    const contentFile = files.find((file) => file.name === "content-cra-mail-in.html");
    expect(contentFile?.content).toBe(postHtml);
  });
});

describe("FAQ upload payload uses cached full html", () => {
  it("maps postContentOptimized on the row to bulk SEO postContent", () => {
    const row = {
      ...createEmptyOverviewRow("https://example.com/cra/"),
      postContentOptimized:
        "<h2>Article</h2><p>Body</p><div class=\"flo-faq\"><h2 id=\"faq\">FAQ</h2></div>",
      faq: "Q?\n\nA.",
    };
    const item = buildOverviewBulkSeoItem(row, { postId: 99, subtype: "post" }, {
      forWordPressUpload: true,
    });
    expect(item?.postContent).toContain("Article");
    expect(item?.postContent).toContain("flo-faq");
  });
});
