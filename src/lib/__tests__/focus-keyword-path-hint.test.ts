import { describe, expect, it } from "vitest";
import { pathSlugToFocusHint } from "@/lib/overview/focus-keyword-path-hint";

describe("pathSlugToFocusHint", () => {
  it("uses last non-blog segment", () => {
    expect(pathSlugToFocusHint("https://youjunkit.ca/blog/winter-declutter-holiday-space/")).toBe(
      "winter declutter holiday space",
    );
  });

  it("handles single slug path", () => {
    expect(pathSlugToFocusHint("https://example.com/roller-shades-installation")).toBe(
      "roller shades installation",
    );
  });

  it("strips common extension", () => {
    expect(pathSlugToFocusHint("https://example.com/blog/my-post.html")).toBe("my post");
  });
});
