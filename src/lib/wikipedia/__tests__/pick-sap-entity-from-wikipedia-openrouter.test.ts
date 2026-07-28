import { afterEach, describe, expect, it, vi } from "vitest";
import { pickSapGeographicEntityFromWikipediaArticle } from "@/lib/wikipedia/pick-sap-entity-from-wikipedia-openrouter";

vi.mock("@/lib/wikipedia/mediawiki-intro", () => ({
  fetchWikipediaIntroPlainText: vi.fn(async () =>
    "Baturyn is a residential neighbourhood in the Castle Downs area of north Edmonton, Alberta, Canada."
  ),
}));

vi.mock("@/lib/wikipedia/wiki-links-lists", () => ({
  getLinksFromWikipediaPage: vi.fn(async () => [
    "Castle Downs",
    "Edmonton",
    "CFB Edmonton",
    "Northern Alberta Institute of Technology",
  ]),
}));

vi.mock("@/lib/api", () => ({
  streamChatCompletion: vi.fn(
    async ({ onContentChunk }: { onContentChunk: (c: string) => void }) => {
      onContentChunk('{"entity":"Castle Downs, Edmonton, AB"}');
      return { content: '{"entity":"Castle Downs, Edmonton, AB"}', isGenerating: false };
    }
  ),
}));

describe("pickSapGeographicEntityFromWikipediaArticle", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns model entity JSON from OpenRouter using intro + link titles (no hardcoded locations)", async () => {
    const out = await pickSapGeographicEntityFromWikipediaArticle({
      apiKey: "test-key",
      parentArticleTitle: "Baturyn, Edmonton",
      originalEntity: "Baturyn, Edmonton",
    });
    expect(out.entity).toBe("Castle Downs, Edmonton, AB");
  });

  it("returns null when api key missing", async () => {
    const out = await pickSapGeographicEntityFromWikipediaArticle({
      apiKey: "",
      parentArticleTitle: "X",
      originalEntity: "Y",
    });
    expect(out.entity).toBeNull();
  });
});
