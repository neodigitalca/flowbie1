/** Shared sitemap grep scorer for placeholder resolve and site cache search. */

export type LinkQueryPost = {
  title: string;
  slug: string;
  excerpt: string;
  link: string;
};

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function scorePostForLinkQuery(post: LinkQueryPost, query: string): number {
  const queryLower = query.toLowerCase().trim();
  if (!queryLower) return 0;

  const queryNorm = normalizeLabel(query);
  const titleNorm = normalizeLabel(post.title || post.slug);
  const slugNorm = normalizeLabel((post.slug || "").replace(/-/g, " "));
  const excerptNorm = normalizeLabel(post.excerpt || "");
  let score = 0;

  if (post.title.toLowerCase().includes(queryLower)) score += 10;
  if (titleNorm === queryNorm) score += 20;
  if (post.link.toLowerCase().includes(queryLower.replace(/\s+/g, "-"))) score += 5;
  if (slugNorm.includes(queryNorm) || queryNorm.includes(slugNorm)) score += 8;
  if (excerptNorm.includes(queryLower)) score += 2;

  const queryWords = queryNorm.split(/\s+/).filter((w) => w.length > 2);
  const titleWords = new Set(titleNorm.split(/\s+/));
  const overlap = queryWords.filter((w) => titleWords.has(w)).length;
  score += overlap * 4;

  return score;
}
