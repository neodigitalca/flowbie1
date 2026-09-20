import { describe, expect, it } from "vitest";
import { parseBulkOverviewSeoResponseText } from "@/lib/wordpress-api/meta";

describe("parseBulkOverviewSeoResponseText", () => {
  it("reads one JSON object", () => {
    const body = JSON.stringify({
      success: true,
      results: [{ postId: 12, index: 0, ok: true }],
      okCount: 1,
      total: 1,
    });
    expect(parseBulkOverviewSeoResponseText(body)).toEqual({
      success: true,
      results: [{ postId: 12, index: 0, ok: true }],
      okCount: 1,
      total: 1,
      error: undefined,
    });
  });

  it("uses the last JSON line that has results", () => {
    const progress = JSON.stringify({
      type: "progress",
      phase: "done",
      batchResults: [],
    });
    const done = JSON.stringify({
      type: "done",
      success: true,
      results: [{ postId: 99, index: 0, ok: true }],
      okCount: 1,
      total: 1,
    });
    expect(parseBulkOverviewSeoResponseText(`${progress}\n${done}`).results[0]?.postId).toBe(99);
  });
});
