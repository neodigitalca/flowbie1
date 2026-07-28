import { describe, expect, it } from "vitest";
import { patchBulkPrefetchedPendingLinkPools } from "../bulk-optimization-pending-link-pools";

describe("patchBulkPrefetchedPendingLinkPools", () => {
  it("writes pages inventory into every prefetched pending row", () => {
    const cache = new Map<number, { pending: Record<string, unknown>; primaryKeyword: string }>();
    cache.set(0, { pending: { url: "https://example.com/a/" }, primaryKeyword: "kw" });
    cache.set(1, { pending: { url: "https://example.com/b/" }, primaryKeyword: "kw2" });

    const posts = [{ id: 1, link: "https://example.com/post/" }];
    const pages = [
      {
        id: 2,
        slug: "about",
        title: "About",
        excerpt: "",
        link: "https://example.com/about/",
        date_gmt: "",
        postType: "page" as const,
      },
    ];

    patchBulkPrefetchedPendingLinkPools(cache, posts, pages);

    expect(cache.get(0)?.pending.wordPressPosts).toEqual(posts);
    expect(cache.get(0)?.pending.wordPressPagesForOfferTable).toEqual(pages);
    expect(cache.get(1)?.pending.wordPressPagesForOfferTable).toEqual(pages);
  });
});
