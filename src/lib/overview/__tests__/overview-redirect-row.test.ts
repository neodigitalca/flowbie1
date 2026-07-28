import { describe, expect, it } from "vitest";
import { buildOverviewRedirectRow } from "@/lib/overview/overview-redirect-row";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";

function row(partial: Partial<OverviewRow>): OverviewRow {
  return {
    url: "https://kwbllp.com/blog/need-a-holding-company/",
    title: "",
    metaDescription: "",
    aiTitle: "",
    aiMeta: "",
    status: "idle",
    ...partial,
  };
}

describe("buildOverviewRedirectRow", () => {
  it("builds pending redirect from live url to cyan suggested destination", () => {
    const entry = buildOverviewRedirectRow(
      row({
        url: "https://kwbllp.com/blog/do-you-still-need-a-holding-company/",
        aiSuggestedPath: "blog/need-a-holding-company/",
      }),
    );
    expect(entry).toEqual({
      source: "blog/do-you-still-need-a-holding-company/",
      destination: "https://kwbllp.com/blog/need-a-holding-company/",
    });
  });

  it("builds post-update redirect from slugRedirectSourceUrl to new row.url", () => {
    const entry = buildOverviewRedirectRow(
      row({
        url: "https://kwbllp.com/blog/need-a-holding-company/",
        slugRedirectSourceUrl: "https://kwbllp.com/blog/do-you-still-need-a-holding-company/",
      }),
    );
    expect(entry).toEqual({
      source: "blog/do-you-still-need-a-holding-company/",
      destination: "https://kwbllp.com/blog/need-a-holding-company/",
    });
  });
});
