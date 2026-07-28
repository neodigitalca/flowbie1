import { describe, expect, it } from "vitest";
import { computeOverviewAiUrlSuggestion } from "@/lib/overview/overview-ai-url-suggest";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";

function row(partial: Partial<OverviewRow>): OverviewRow {
  return {
    url: "https://kwbllp.com/blog/do-you-still-need-a-holding-company/",
    title: "",
    metaDescription: "",
    aiTitle: "",
    aiMeta: "",
    focusKeyword: "need a holding company",
    status: "idle",
    ...partial,
  };
}

describe("computeOverviewAiUrlSuggestion", () => {
  it("returns redirect when suggested path differs from live url", () => {
    const result = computeOverviewAiUrlSuggestion(row({}));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch.aiSuggestedPath).toBe("blog/need-a-holding-company/");
    expect(result.redirect).toEqual({
      source: "blog/do-you-still-need-a-holding-company/",
      destination: "https://kwbllp.com/blog/need-a-holding-company/",
    });
  });

  it("returns no redirect when path already matches keyword slug", () => {
    const result = computeOverviewAiUrlSuggestion(
      row({
        url: "https://kwbllp.com/blog/need-a-holding-company/",
        focusKeyword: "need a holding company",
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.redirect).toBeNull();
  });
});
