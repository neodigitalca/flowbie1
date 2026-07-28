/**
 * Performance benchmarks for optimized paths.
 * Run with: npx vitest bench
 */
import { bench, describe } from 'vitest';
import {
  setSiteCacheForTest,
  searchSiteCache,
  clearSiteCache,
  type CachedPost,
} from '../wordpress-site-cache';
import { sanitizePlaceholders, removeColons } from '../content-generation/content-sanitizer';

const BENCH_SITE_ID = 'bench-site';

function generateMockPosts(n: number): CachedPost[] {
  const posts: CachedPost[] = [];
  for (let i = 0; i < n; i++) {
    posts.push({
      id: i + 1,
      slug: `post-${i}`,
      title: `Post ${i} about plumbing and services`,
      excerpt: `Excerpt ${i}`,
      link: `https://example.com/post-${i}`,
      date_gmt: '',
    });
  }
  return posts;
}

describe('bench: searchSiteCache', () => {
  const posts500 = generateMockPosts(500);
  setSiteCacheForTest(BENCH_SITE_ID, 'https://example.com', posts500);

  bench('searchSiteCache with 500 posts, single query', () => {
    searchSiteCache(BENCH_SITE_ID, 'plumbing', 50);
  });

  bench('searchSiteCache with 500 posts, 10 queries', () => {
    for (let i = 0; i < 10; i++) {
      searchSiteCache(BENCH_SITE_ID, 'plumbing services', 50);
    }
  });
});

describe('bench: sanitizePlaceholders', () => {
  const longContent =
    'Lorem ipsum. [table] dolor [image] sit. '.repeat(200) +
    '[insert link here] and [content placeholder] more. '.repeat(20);

  bench('sanitizePlaceholders ~15k chars with placeholders', () => {
    sanitizePlaceholders(longContent);
  });
});

describe('bench: removeColons', () => {
  const contentWithUrls =
    'Section 1: Introduction. See https://example.com/page. Section 2: Details. Visit https://example.com/other. '.repeat(100);

  bench('removeColons ~10k chars with URLs', () => {
    removeColons(contentWithUrls);
  });
});

