import { describe, expect, it } from "vitest";
import { extractMentionUserIds } from "@/lib/chat-mention-utils";

describe("extractMentionUserIds", () => {
  it("parses mention spans from html string", () => {
    const html =
      '<p>Hi <span data-type="mention" data-id="42" data-label="Sean">@Sean</span></p>';
    expect(extractMentionUserIds(html)).toEqual([42]);
  });

  it("dedupes multiple mentions", () => {
    const html =
      '<span data-type="mention" data-id="3"></span> and <span data-type="mention" data-id="3"></span>';
    expect(extractMentionUserIds(html)).toEqual([3]);
  });

  it("returns empty for no mentions", () => {
    expect(extractMentionUserIds("<p>hello</p>")).toEqual([]);
  });
});
