import { beforeEach, describe, expect, it, vi } from "vitest";

const lookupEntityHintWikipedia = vi.fn();
const checkWikipediaPageExists = vi.fn();
const fetchWikipediaIntroPlainText = vi.fn();

vi.mock("../entity-hint-lookup", () => ({
  lookupEntityHintWikipedia: (...args: unknown[]) => lookupEntityHintWikipedia(...args),
}));

vi.mock("../mediawiki-search", () => ({
  checkWikipediaPageExists: (...args: unknown[]) => checkWikipediaPageExists(...args),
}));

vi.mock("../mediawiki-intro", () => ({
  fetchWikipediaIntroPlainText: (...args: unknown[]) => fetchWikipediaIntroPlainText(...args),
  SAP_WIKI_PROMPT_MAX_PER_CLUSTER: 1600,
}));

describe("fetchWikipediaClustersForSapEntityHints", () => {
  beforeEach(() => {
    lookupEntityHintWikipedia.mockReset();
    checkWikipediaPageExists.mockReset();
    fetchWikipediaIntroPlainText.mockReset();
    fetchWikipediaIntroPlainText.mockResolvedValue("Intro text.");
  });

  it("uses preferredTitles fast path without full lookup", async () => {
    checkWikipediaPageExists.mockResolvedValue({
      exists: true,
      title: "Angel Mounds",
      url: "https://en.wikipedia.org/wiki/Angel_Mounds",
    });
    const { fetchWikipediaClustersForSapEntityHints } = await import("../sap-wiki-clusters");
    const out = await fetchWikipediaClustersForSapEntityHints(["Angel Mounds"], {
      preferredTitles: ["Angel Mounds", "Other Place"],
    });
    expect(lookupEntityHintWikipedia).not.toHaveBeenCalled();
    expect(out).toHaveLength(1);
    expect(out[0]?.title).toBe("Angel Mounds");
  });

  it("resolves unique hints in parallel and reports progress", async () => {
    lookupEntityHintWikipedia.mockImplementation(async (hint: string) => ({
      kind: "exact",
      title: hint,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hint)}`,
    }));
    const { fetchWikipediaClustersForSapEntityHints } = await import("../sap-wiki-clusters");
    const progress: Array<{ done: number; total: number }> = [];
    const out = await fetchWikipediaClustersForSapEntityHints(
      ["Place A", "Place B", "Place A"],
      {
        onWikiProgress: (done, total) => progress.push({ done, total }),
      },
    );
    expect(out).toHaveLength(2);
    expect(lookupEntityHintWikipedia).toHaveBeenCalledTimes(2);
    expect(progress.at(-1)).toEqual({ done: 2, total: 2 });
  });
});
