import { describe, expect, it, vi, beforeEach } from "vitest";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewBinding } from "@/hooks/overview/use-overview-wordpress-binding";
import type { OverviewInventoryUrlMatch } from "@/lib/overview/overview-row-scrape";

vi.mock("@/lib/overview/overview-bulk-seo-payload", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/overview/overview-bulk-seo-payload")>();
  return {
    ...actual,
    uploadOverviewRowSeoToWordPress: vi.fn(),
  };
});

import { uploadOverviewRowSeoToWordPress } from "@/lib/overview/overview-bulk-seo-payload";
import { uploadOverviewResearchedRowToWordPress } from "@/lib/overview/overview-research-row-wp-upload";

function makeSite(): WordPressSite {
  return {
    id: "site-1",
    name: "Test",
    siteUrl: "https://example.com",
    username: "u",
    appPassword: "p",
    connectedAt: 0,
  };
}

function makeRow(overrides: Partial<OverviewRow> = {}): OverviewRow {
  return {
    url: "https://example.com/blinds",
    title: "Blinds",
    metaDescription: "",
    aiTitle: "",
    aiMeta: "",
    status: "idle",
    focusKeyword: "blinds",
    seoResearch: '{"brief":true}',
    ...overrides,
  };
}

function makeMatch(postId: number): OverviewInventoryUrlMatch {
  return {
    subtype: "page",
    row: {
      id: postId,
      url: "https://example.com/blinds",
      fields: { title: "Blinds", meta: "", keyword: "blinds" },
    },
  };
}

describe("uploadOverviewResearchedRowToWordPress", () => {
  beforeEach(() => {
    vi.mocked(uploadOverviewRowSeoToWordPress).mockReset();
  });

  it("skips when the row has no brief", async () => {
    const result = await uploadOverviewResearchedRowToWordPress({
      site: makeSite(),
      row: makeRow({ seoResearch: "   " }),
      bindings: {},
      getInventoryMatchForUrl: () => makeMatch(42),
    });

    expect(result).toEqual({ ok: false, skipped: true });
    expect(uploadOverviewRowSeoToWordPress).not.toHaveBeenCalled();
  });

  it("skips when there is no WordPress post id", async () => {
    const result = await uploadOverviewResearchedRowToWordPress({
      site: makeSite(),
      row: makeRow(),
      bindings: {},
      getInventoryMatchForUrl: () => undefined,
    });

    expect(result).toEqual({ ok: false, skipped: true });
    expect(uploadOverviewRowSeoToWordPress).not.toHaveBeenCalled();
  });

  it("uploads the merged seoResearch when the row is bound", async () => {
    vi.mocked(uploadOverviewRowSeoToWordPress).mockResolvedValue({ ok: true, link: "https://example.com/blinds" });
    const row = makeRow({ seoResearch: '{"keyword":"window shades"}' });
    const binding: OverviewBinding = { postId: 99, subtype: "page" };

    const result = await uploadOverviewResearchedRowToWordPress({
      site: makeSite(),
      row,
      bindings: { "https://example.com/blinds": binding },
      getInventoryMatchForUrl: () => undefined,
    });

    expect(result).toEqual({ ok: true, skipped: false, postId: 99 });
    expect(uploadOverviewRowSeoToWordPress).toHaveBeenCalledTimes(1);
    const [, uploadedRow, uploadedBinding] = vi.mocked(uploadOverviewRowSeoToWordPress).mock.calls[0]!;
    expect(uploadedRow.seoResearch).toBe('{"keyword":"window shades"}');
    expect(uploadedBinding.postId).toBe(99);
  });

  it("returns a visible failure when WordPress rejects the write", async () => {
    vi.mocked(uploadOverviewRowSeoToWordPress).mockResolvedValue({
      ok: false,
      error: "WordPress rejected the update.",
    });

    const result = await uploadOverviewResearchedRowToWordPress({
      site: makeSite(),
      row: makeRow(),
      bindings: {},
      getInventoryMatchForUrl: () => makeMatch(7),
    });

    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.error).toBe("WordPress rejected the update.");
    expect(result.postId).toBe(7);
  });
});
