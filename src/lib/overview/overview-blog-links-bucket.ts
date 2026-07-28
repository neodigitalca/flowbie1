import type { BulkOptimizerInventorySnapshot } from "@/lib/wordpress-api/inventory-match";
import { lookupInMaps } from "@/lib/wordpress-api/inventory-match";
import type { BlogLinkCandidate } from "@/lib/overview/overview-blog-links-catalog";

export type LinkInventoryBucket = "post" | "page";

/** Dated permalink paths (e.g. /2016/08/23/slug/) → posts bucket. */
export function inferLinkBucketFromUrlPath(url: string): LinkInventoryBucket | null {
  try {
    const path = new URL(url.trim()).pathname;
    if (/\/\d{4}\/\d{1,2}\/\d{1,2}\//.test(path)) return "post";
    if (/\/\d{4}\/\d{1,2}\//.test(path)) return "post";
  } catch {
    return null;
  }
  return null;
}

export function resolveLinkInventoryBucket(
  snapshot: BulkOptimizerInventorySnapshot | null,
  siteUrl: string,
  url: string,
): LinkInventoryBucket | null {
  if (snapshot) {
    if (lookupInMaps(snapshot.pagesMaps, siteUrl, url)) return "page";
    if (lookupInMaps(snapshot.postsMaps, siteUrl, url)) return "post";
  }
  return inferLinkBucketFromUrlPath(url);
}

export function filterCandidatesByBucket(
  candidates: BlogLinkCandidate[],
  bucket: LinkInventoryBucket,
): BlogLinkCandidate[] {
  return candidates.filter((c) => c.bucket === bucket);
}

export function splitCandidatesByBucket(candidates: BlogLinkCandidate[]): {
  post: BlogLinkCandidate[];
  page: BlogLinkCandidate[];
} {
  return {
    post: candidates.filter((c) => c.bucket === "post"),
    page: candidates.filter((c) => c.bucket === "page"),
  };
}

export function allowedCandidatesForLinkBucket(
  candidates: BlogLinkCandidate[],
  bucket: LinkInventoryBucket | null,
): BlogLinkCandidate[] {
  if (!bucket) return candidates;
  const filtered = filterCandidatesByBucket(candidates, bucket);
  return filtered.length ? filtered : candidates;
}
