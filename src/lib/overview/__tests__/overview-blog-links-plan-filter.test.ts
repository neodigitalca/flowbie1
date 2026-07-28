import { describe, expect, it } from "vitest";
import { isProtectedBlogLinkHref } from "@/lib/overview/overview-blog-links-plan-filter";

describe("isProtectedBlogLinkHref", () => {
  it("flags consultation URLs", () => {
    expect(isProtectedBlogLinkHref("https://kwbllp.com/consultation/")).toBe(true);
    expect(isProtectedBlogLinkHref("/consultation/")).toBe(true);
  });

  it("allows blog post URLs", () => {
    expect(isProtectedBlogLinkHref("https://kwbllp.com/blog/tax-tips/")).toBe(false);
  });
});
