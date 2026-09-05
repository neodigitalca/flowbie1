import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/keyword-mcp-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/keyword-mcp-service")>();
  return {
    ...actual,
    callMCPKeywordOverview: vi.fn(),
  };
});

import { keywordsForLabsOverview, callMCPKeywordOverview } from "@/lib/keyword-mcp-service";
import { getKeywordOverview } from "@/lib/keyword-api";

describe("keywordsForLabsOverview", () => {
  it("sends lowercase search queries, not title-case display strings", () => {
    expect(
      keywordsForLabsOverview([
        "Hunter Douglas Vs Alta Window Fashions Price Comparison",
        "  Alta Versus Hunter Douglas  ",
        "",
      ]),
    ).toEqual([
      "hunter douglas vs alta window fashions price comparison",
      "alta versus hunter douglas",
    ]);
  });
});

describe("getKeywordOverview empty Labs result", () => {
  beforeEach(() => {
    vi.mocked(callMCPKeywordOverview).mockReset();
  });

  it("returns an empty list when Labs has no items, and does not throw", async () => {
    vi.mocked(callMCPKeywordOverview).mockResolvedValue([]);
    await expect(
      getKeywordOverview(
        ["zz-play-empty-overview-test-keyword"],
        "United States",
        "en",
      ),
    ).resolves.toEqual([]);
  });
});
