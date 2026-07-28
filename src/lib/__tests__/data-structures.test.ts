/**
 * Unit tests for new data structures (titleIndex, urlIndex, normalized URL Set, combined regex).
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  setSiteCacheForTest,
  getSiteCache,
  searchSiteCache,
  clearSiteCache,
  type CachedPost,
} from '../wordpress-site-cache';
import { sanitizePlaceholders } from '../content-generation/content-sanitizer';

describe('data-structures: site cache titleIndex', () => {
  const SITE_ID = 'ds-title-index';

  afterEach(() => clearSiteCache(SITE_ID));

  it('indexes posts by words in title', () => {
    const posts: CachedPost[] = [
      { id: 1, slug: 'a', title: 'Plumber Near Me', excerpt: '', link: 'https://example.com/a', date_gmt: '' },
      { id: 2, slug: 'b', title: 'Local Plumber', excerpt: '', link: 'https://example.com/b', date_gmt: '' },
    ];
    setSiteCacheForTest(SITE_ID, 'https://example.com', posts);
    const results = searchSiteCache(SITE_ID, 'Plumber', 10);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((p) => p.title.toLowerCase().includes('plumber'))).toBe(true);
  });

  it('returns empty for word not in any title', () => {
    const posts: CachedPost[] = [
      { id: 1, slug: 'a', title: 'Only This', excerpt: '', link: 'https://example.com/a', date_gmt: '' },
    ];
    setSiteCacheForTest(SITE_ID, 'https://example.com', posts);
    const results = searchSiteCache(SITE_ID, 'nonexistentword', 10);
    expect(results).toEqual([]);
  });
});

describe('data-structures: site cache urlIndex', () => {
  const SITE_ID = 'ds-url-index';

  afterEach(() => clearSiteCache(SITE_ID));

  it('cache contains urlIndex after setSiteCacheForTest', () => {
    const posts: CachedPost[] = [
      { id: 1, slug: 'page', title: 'Page', excerpt: '', link: 'https://example.com/page', date_gmt: '' },
    ];
    setSiteCacheForTest(SITE_ID, 'https://example.com', posts);
    const cache = getSiteCache(SITE_ID);
    expect(cache).not.toBeNull();
    expect(cache!.urlIndex).toBeDefined();
    expect(cache!.urlIndex.get('https://example.com/page')).toBeDefined();
  });
});

describe('data-structures: combined placeholder regex', () => {
  it('matches placeholder patterns without false positive on markdown link', () => {
    const withLink = 'Text [click here](https://example.com) more.';
    const out = sanitizePlaceholders(withLink);
    expect(out).toContain('[click here](https://example.com)');
  });

  it('removes [table] and [image] placeholders', () => {
    const input = 'Content [table] here [image] end.';
    const out = sanitizePlaceholders(input);
    expect(out).not.toContain('[table]');
    expect(out).not.toContain('[image]');
  });

  it('leaves content unchanged when no placeholders', () => {
    const input = 'Clean content with no placeholders.';
    expect(sanitizePlaceholders(input).trim()).toBe(input);
  });
});
