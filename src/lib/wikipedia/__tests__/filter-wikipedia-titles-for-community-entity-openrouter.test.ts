import { afterEach, describe, expect, it, vi } from "vitest";
import { filterWikipediaTitlesForCommunityEntity } from "@/lib/wikipedia/filter-wikipedia-titles-for-community-entity-openrouter";

vi.mock("@/lib/api", () => ({
  streamChatCompletion: vi.fn(
    async ({ onContentChunk }: { onContentChunk: (c: string) => void }) => {
      onContentChunk('{"kept":["Neighbourhood A","Stockton"]}');
      return { content: '{"kept":["Neighbourhood A","Stockton"]}', isGenerating: false };
    }
  ),
}));

describe("filterWikipediaTitlesForCommunityEntity", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns subset from model JSON preserving order and canonical spelling", async () => {
    const out = await filterWikipediaTitlesForCommunityEntity({
      apiKey: "k",
      titles: ["The Big Eddy Site", "Neighbourhood A", "Stockton", "Some Federation"],
      introSnippets: ["archaeological site", "residential area", "city", "sports body"],
    });
    expect(out).toEqual(["Neighbourhood A", "Stockton"]);
  });

  it("throws when api key missing", async () => {
    await expect(
      filterWikipediaTitlesForCommunityEntity({
        apiKey: "",
        titles: ["A", "B"],
      })
    ).rejects.toThrow(/OpenRouter API key is required/);
  });
});

describe("filterWikipediaTitlesForCommunityEntity strict (no unfiltered fallback)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty when JSON parse fails", async () => {
    const { streamChatCompletion } = await import("@/lib/api");
    vi.mocked(streamChatCompletion).mockImplementation(
      async ({ onContentChunk }: { onContentChunk: (c: string) => void }) => {
        onContentChunk("not json");
        return { content: "not json", isGenerating: false };
      }
    );
    const titles = ["Only Town", "Other"];
    const out = await filterWikipediaTitlesForCommunityEntity({
      apiKey: "k",
      titles,
    });
    expect(out).toEqual([]);
  });

  it("returns empty when kept is empty array", async () => {
    const { streamChatCompletion } = await import("@/lib/api");
    vi.mocked(streamChatCompletion).mockImplementation(
      async ({ onContentChunk }: { onContentChunk: (c: string) => void }) => {
        onContentChunk('{"kept":[]}');
        return { content: '{"kept":[]}', isGenerating: false };
      }
    );
    const titles = ["X", "Y"];
    const out = await filterWikipediaTitlesForCommunityEntity({
      apiKey: "k",
      titles,
    });
    expect(out).toEqual([]);
  });
});
