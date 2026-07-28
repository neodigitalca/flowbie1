/**
 * Parity / behavior tests for performance-optimized code.
 * Ensures optimized implementations produce correct, deterministic results.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  searchSiteCache,
  setSiteCacheForTest,
  clearSiteCache,
  type CachedPost,
} from '../wordpress-site-cache';
import { sanitizePlaceholders, removeColons } from '../content-generation/content-sanitizer';
import { countInternalLinksInMarkdown } from '../content-generation/ensure-links-per-section';

describe('parity: searchSiteCache', () => {
  const SITE_ID = 'snapshot-test-site';

  afterEach(() => {
    clearSiteCache(SITE_ID);
  });

  it('returns identical results for same query (indexed lookup)', () => {
    const posts: CachedPost[] = [
      { id: 1, slug: 'plumber-near-me', title: 'Best Plumber Near Me', excerpt: 'Find a plumber', link: 'https://example.com/plumber-near-me', date_gmt: '' },
      { id: 2, slug: 'plumber', title: 'Local Plumber Services', excerpt: 'Plumber', link: 'https://example.com/plumber', date_gmt: '' },
      { id: 3, slug: 'other', title: 'Other Page', excerpt: 'No match', link: 'https://example.com/other', date_gmt: '' },
    ];
    setSiteCacheForTest(SITE_ID, 'https://example.com', posts);

    const run1 = searchSiteCache(SITE_ID, 'plumber', 50);
    const run2 = searchSiteCache(SITE_ID, 'plumber', 50);
    expect(run1.map((p) => p.id)).toEqual(run2.map((p) => p.id));
    expect(run1.length).toBeGreaterThanOrEqual(1);
    expect(run1.some((p) => p.title.toLowerCase().includes('plumber'))).toBe(true);
  });

  it('returns empty for unknown site', () => {
    expect(searchSiteCache('nonexistent', 'plumber', 10)).toEqual([]);
  });
});

describe('parity: sanitizePlaceholders', () => {
  it('removes bracket placeholders and produces deterministic output', () => {
    const input = 'Hello [table] world [image] and [insert link here] end.';
    const out1 = sanitizePlaceholders(input);
    const out2 = sanitizePlaceholders(input);
    expect(out1).toBe(out2);
    expect(out1).not.toContain('[table]');
    expect(out1).not.toContain('[image]');
    expect(out1).not.toContain('[insert link here]');
  });

  it('preserves markdown links', () => {
    const input = 'See [click here](https://example.com) for more.';
    const out = sanitizePlaceholders(input);
    expect(out).toContain('[click here](https://example.com)');
  });
});

describe('parity: removeColons', () => {
  it('replaces standalone colons but preserves URLs', () => {
    const input = 'Title: Subtitle. Visit https://example.com/path for more.';
    const out = removeColons(input);
    expect(out).toContain('https://example.com/path');
    expect(out).not.toMatch(/Title:\s*Subtitle/);
    expect(out).toMatch(/Title\.\s*Subtitle/);
  });

  it('produces identical output for same input', () => {
    const input = 'A: B. Link: https://x.com. C: D.';
    expect(removeColons(input)).toBe(removeColons(input));
  });
});

describe('parity: countInternalLinksInMarkdown', () => {
  const siteUrl = 'https://example.com';
  const wordPressPosts = [
    { id: 1, slug: 'page-a', title: 'Page A', excerpt: '', link: 'https://example.com/page-a', date_gmt: '' },
    { id: 2, slug: 'page-b', title: 'Page B', excerpt: '', link: 'https://example.com/page-b', date_gmt: '' },
  ];

  it('counts internal links deterministically', () => {
    const markdown = 'See [Page A](https://example.com/page-a) and [Page B](https://example.com/page-b).';
    const n1 = countInternalLinksInMarkdown(markdown, wordPressPosts, siteUrl);
    const n2 = countInternalLinksInMarkdown(markdown, wordPressPosts, siteUrl);
    expect(n1).toBe(n2);
    expect(n1).toBe(2);
  });

  it('ignores external links', () => {
    const markdown = 'External [Other](https://other.com/page).';
    expect(countInternalLinksInMarkdown(markdown, wordPressPosts, siteUrl)).toBe(0);
  });
});
