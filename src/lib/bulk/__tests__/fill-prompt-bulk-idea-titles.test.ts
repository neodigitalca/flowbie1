import { describe, expect, it, vi, beforeEach } from "vitest";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";

vi.mock("@/lib/bulk/bulk-post-title-agent", () => ({
  resolveBulkWordPressPostTitle: vi.fn(),
}));

import { resolveBulkWordPressPostTitle } from "@/lib/bulk/bulk-post-title-agent";
import { fillPromptBulkIdeaTitlesFromAgent } from "@/lib/bulk/fill-prompt-bulk-idea-titles";

const mockTitle = vi.mocked(resolveBulkWordPressPostTitle);

describe("fillPromptBulkIdeaTitlesFromAgent", () => {
  beforeEach(() => {
    mockTitle.mockReset();
  });

  it("writes a title-agent headline instead of the pasted keyword", async () => {
    mockTitle.mockResolvedValue("How To Choose Between Skyline And Hunter Douglas");
    const rows: CSVRow[] = [
      {
        keyword: "Skyline Blind Solutions Vs Hunter Douglas Solutions",
        title: "Skyline Blind Solutions Vs Hunter Douglas Solutions",
      },
    ];

    await fillPromptBulkIdeaTitlesFromAgent({
      rows,
      apiKey: "test-key",
    });

    expect(rows[0]!.title).toBe("How To Choose Between Skyline And Hunter Douglas");
    expect(mockTitle).toHaveBeenCalledWith(
      expect.objectContaining({
        focusKeyword: "Skyline Blind Solutions Vs Hunter Douglas Solutions",
        candidates: {
          csvTitle: "Skyline Blind Solutions Vs Hunter Douglas Solutions",
        },
      }),
    );
  });

  it("keeps a title the user already typed in the slot", async () => {
    const rows: CSVRow[] = [
      { keyword: "skyline vs hunter douglas", title: "Ideas pasted keyword" },
    ];

    await fillPromptBulkIdeaTitlesFromAgent({
      rows,
      apiKey: "test-key",
      preservedSlotTitles: ["My Own Headline"],
    });

    expect(mockTitle).not.toHaveBeenCalled();
    expect(rows[0]!.title).toBe("Ideas pasted keyword");
  });

  it("skips rows with no keyword", async () => {
    const rows: CSVRow[] = [{ keyword: "", title: "" }];
    await fillPromptBulkIdeaTitlesFromAgent({ rows, apiKey: "test-key" });
    expect(mockTitle).not.toHaveBeenCalled();
  });
});
