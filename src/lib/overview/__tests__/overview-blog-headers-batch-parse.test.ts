import { describe, expect, it } from "vitest";
import { parseBlogHeadersBatchJson } from "@/lib/overview/overview-blog-headers-batch-parse";

describe("parseBlogHeadersBatchJson", () => {
  it("parses fenced JSON with results array", () => {
    const raw = '```json\n{"results":[{"url":"https://x.com/a","h2Actions":[{"action":"optimize","index":0,"proposedText":"New H2","rationale":"weak"}]}]}\n```';
    const map = parseBlogHeadersBatchJson(raw);
    expect(map.get("https://x.com/a")?.h2Actions[0]?.proposedText).toBe("New H2");
  });

  it("parses top-level array", () => {
    const raw = '[{"url":"https://x.com/b","h2Actions":[]}]';
    const map = parseBlogHeadersBatchJson(raw);
    expect(map.has("https://x.com/b")).toBe(true);
  });
});
