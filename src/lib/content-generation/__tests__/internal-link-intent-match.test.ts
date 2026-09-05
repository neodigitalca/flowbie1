import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  formatSuggestLinkInventory,
  matchInternalLinkQueriesToCatalog,
  parseSuggestLinkNumbers,
  pickSuggestLinkUrl,
} from "../internal-link-intent-match";

vi.mock("@/lib/competitor-research/competitor-report-openrouter", () => ({
  callOpenRouterChatCompletion: vi.fn(),
}));

import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";

const catalog = [
  {
    title: "Hunter Douglas",
    url: "https://lindseyblindsetc.com/hunter-douglas/",
    collection: "pages",
  },
  {
    title: "Energy Efficiency",
    url: "https://lindseyblindsetc.com/technology/energy-efficiency/",
    collection: "pages",
  },
  { title: "Home", url: "https://lindseyblindsetc.com/", collection: "pages" },
  {
    title: "PowerView Guide",
    url: "https://lindseyblindsetc.com/blog/powerview-guide/",
    collection: "posts",
  },
];

const queries = [
  { id: "1", query: "Hunter Douglas", anchor: "Hunter Douglas shades" },
  { id: "2", query: "Energy Efficiency", anchor: "energy efficiency" },
];

describe("parseSuggestLinkNumbers", () => {
  it("reads the plugin comma-separated page numbers", () => {
    expect(parseSuggestLinkNumbers("3,7,12,1,5")).toEqual([3, 7, 12, 1, 5]);
  });

  it("ignores 0 and leftover words", () => {
    expect(parseSuggestLinkNumbers("0")).toEqual([]);
    expect(parseSuggestLinkNumbers("1 2")).toEqual([1, 2]);
  });
});

describe("pickSuggestLinkUrl", () => {
  it("uses the first unused inventory number", () => {
    expect(pickSuggestLinkUrl([1, 2], catalog, new Set())).toBe(
      "https://lindseyblindsetc.com/hunter-douglas/",
    );
  });

  it("skips a used URL and takes the next ranked row", () => {
    const used = new Set(["https://lindseyblindsetc.com/hunter-douglas"]);
    expect(pickSuggestLinkUrl([1, 2], catalog, used)).toBe(
      "https://lindseyblindsetc.com/technology/energy-efficiency/",
    );
  });

  it("returns empty when ranked numbers are used or missing", () => {
    const used = new Set(["https://lindseyblindsetc.com/hunter-douglas"]);
    expect(pickSuggestLinkUrl([1], catalog, used)).toBe("");
    expect(pickSuggestLinkUrl([], catalog, new Set())).toBe("");
  });
});

describe("formatSuggestLinkInventory", () => {
  it("labels page and blog rows", () => {
    const list = formatSuggestLinkInventory(catalog);
    expect(list).toContain('[PAGE] "Hunter Douglas"');
    expect(list).toContain('[BLOG] "PowerView Guide"');
  });
});

describe("matchInternalLinkQueriesToCatalog", () => {
  beforeEach(() => {
    vi.mocked(callOpenRouterChatCompletion).mockReset();
  });

  it("maps Hunter Douglas and Energy Efficiency from plugin page numbers", async () => {
    vi.mocked(callOpenRouterChatCompletion)
      .mockResolvedValueOnce({ raw: {}, content: "1" })
      .mockResolvedValueOnce({ raw: {}, content: "2" });

    const out = await matchInternalLinkQueriesToCatalog({
      queries,
      catalog,
      apiKey: "test-key",
    });

    expect(out.get("1")).toBe("https://lindseyblindsetc.com/hunter-douglas/");
    expect(out.get("2")).toBe("https://lindseyblindsetc.com/technology/energy-efficiency/");
    expect(callOpenRouterChatCompletion).toHaveBeenCalledTimes(2);
    const call = vi.mocked(callOpenRouterChatCompletion).mock.calls[0]![0];
    expect(call.model).toContain("gemini");
    expect(call.system).toContain("internal-linking assistant");
    expect(call.system).toContain("Example: 3,7,12,1,5");
    expect(call.system).toContain("Brand, product, service");
    expect(call.system).toContain("rank [PAGE] rows only");
    expect(call.user).toContain("Highlighted text: \"Hunter Douglas\"");
    expect(call.user).toContain('[PAGE] "Hunter Douglas"');
    expect(call.maxTokens).toBe(30);
  });

  it("leaves a slot unmatched when Gemini returns 0", async () => {
    vi.mocked(callOpenRouterChatCompletion)
      .mockResolvedValueOnce({ raw: {}, content: "0" })
      .mockResolvedValueOnce({ raw: {}, content: "0" });

    const out = await matchInternalLinkQueriesToCatalog({
      queries,
      catalog,
      apiKey: "test-key",
    });

    expect(out.has("1")).toBe(false);
    expect(out.has("2")).toBe(false);
  });
});
