import { describe, expect, it } from "vitest";
import { dedupeAgentRunLogLines } from "@/lib/agent-runs/agent-run-log-download";

describe("dedupeAgentRunLogLines", () => {
  it("removes duplicate lines while preserving order", () => {
    const input = ["Starting…", "Post 1/3", "Post 1/3", "Post 2/3", "Starting…"];
    expect(dedupeAgentRunLogLines(input)).toEqual(["Starting…", "Post 1/3", "Post 2/3"]);
  });
});

describe("post creator wordpress artifact link parsing", () => {
  it("extracts link field from artifact JSON", () => {
    const content = JSON.stringify({
      postId: 5223,
      title: "Battery Powered Shades",
      link: "https://example.com/blog/battery-powered-shades/",
      scheduledDate: "2026-09-01T09:00:00.000Z",
    });
    const parsed = JSON.parse(content) as { link?: string; post_url?: string };
    const url = parsed.link?.trim() || parsed.post_url?.trim();
    expect(url).toBe("https://example.com/blog/battery-powered-shades/");
  });
});
