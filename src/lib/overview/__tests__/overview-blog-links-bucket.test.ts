import { describe, expect, it } from "vitest";
import {
  filterCandidatesByBucket,
  inferLinkBucketFromUrlPath,
  allowedCandidatesForLinkBucket,
} from "@/lib/overview/overview-blog-links-bucket";
import type { BlogLinkCandidate } from "@/lib/overview/overview-blog-links-catalog";

describe("inferLinkBucketFromUrlPath", () => {
  it("treats dated permalinks as post bucket", () => {
    expect(inferLinkBucketFromUrlPath("https://example.com/2016/08/23/top-7-tax-deductions/0")).toBe(
      "post",
    );
    expect(inferLinkBucketFromUrlPath("https://example.com/2024/03/article-name/")).toBe("post");
  });

  it("returns null for undated paths", () => {
    expect(inferLinkBucketFromUrlPath("https://example.com/consultation/")).toBeNull();
    expect(inferLinkBucketFromUrlPath("https://example.com/blog/tax-tips/")).toBeNull();
  });
});

describe("filterCandidatesByBucket", () => {
  const candidates: BlogLinkCandidate[] = [
    { url: "https://example.com/blog/tax/", title: "Tax", excerpt: "", bucket: "post" },
    { url: "https://example.com/consultation/", title: "Consult", excerpt: "", bucket: "page" },
  ];

  it("keeps page bucket URLs for page links", () => {
    const pages = filterCandidatesByBucket(candidates, "page");
    expect(pages).toHaveLength(1);
    expect(pages[0]?.bucket).toBe("page");
  });

  it("keeps post bucket URLs for blog links", () => {
    const posts = filterCandidatesByBucket(candidates, "post");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.bucket).toBe("post");
  });
});

describe("allowedCandidatesForLinkBucket", () => {
  const candidates: BlogLinkCandidate[] = [
    { url: "https://example.com/blog/a/", title: "A", excerpt: "", bucket: "post" },
  ];

  it("falls back to all candidates when bucket pool is empty", () => {
    expect(allowedCandidatesForLinkBucket(candidates, "page")).toEqual(candidates);
  });
});
