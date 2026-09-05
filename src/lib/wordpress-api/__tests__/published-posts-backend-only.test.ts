import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPublishedPages, getPublishedPosts } from "@/lib/wordpress-api/posts";

describe("published posts and pages use the app API", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        return {
          ok: true,
          json: async () =>
            url.includes("get-posts-list")
              ? { posts: [], total: 0 }
              : { count: 0, posts: [], total: 0 },
          text: async () => "{}",
        } as Response;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getPublishedPosts posts to /api/wordpress/get-published-posts", async () => {
    await getPublishedPosts("https://example.com", "user", "pass", 10, 0);
    expect(fetch).toHaveBeenCalled();
    const url = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(url).toContain("/api/wordpress/get-published-posts");
    expect(url).not.toContain("/wp-json/");
    expect(url).not.toContain("openrouter.ai");
  });

  it("getPublishedPages posts to /api/wordpress/get-posts-list", async () => {
    await getPublishedPages("https://example.com", "user", "pass", 10, 0);
    const url = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(url).toContain("/api/wordpress/get-posts-list");
    expect(url).not.toContain("/wp-json/");
  });
});
