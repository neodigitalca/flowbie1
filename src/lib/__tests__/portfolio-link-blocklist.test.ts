import { describe, it, expect } from 'vitest';
import type { WordPressSite } from '@/components/integrations/types';
import { buildPortfolioBlockedHosts } from '../portfolio-link-blocklist';

function mockSite(id: string, name: string, siteUrl: string): WordPressSite {
  return {
    id,
    name,
    siteUrl,
    username: '',
    appPassword: '',
    connectedAt: 0,
  };
}

describe('buildPortfolioBlockedHosts', () => {
  it('excludes current site by id and includes other registrable hosts', () => {
    const sites: WordPressSite[] = [
      mockSite('a', 'A', 'https://www.client-a.com'),
      mockSite('b', 'B', 'https://client-b.ca/path'),
    ];
    const blocked = buildPortfolioBlockedHosts(sites, { excludeSiteId: 'a' });
    expect(blocked.some((h) => h.includes('client-a'))).toBe(false);
    expect(blocked.some((h) => h === 'client-b.ca')).toBe(true);
  });

  it('excludes by site URL when id not used', () => {
    const sites: WordPressSite[] = [
      mockSite('1', 'One', 'https://alpha.example.com'),
      mockSite('2', 'Two', 'https://beta.example.org'),
    ];
    const blocked = buildPortfolioBlockedHosts(sites, {
      excludeSiteUrl: 'https://www.alpha.example.com/',
    });
    expect(blocked.some((h) => h.includes('alpha'))).toBe(false);
    expect(blocked.some((h) => h.includes('beta'))).toBe(true);
  });

  it('includes hosts from both staging and production URLs on a single site', () => {
    const sites: WordPressSite[] = [
      {
        ...mockSite('x', 'X', 'https://staging.client.com'),
        productionSiteUrl: 'https://www.client.com',
      },
    ];
    const blocked = buildPortfolioBlockedHosts(sites, { excludeSiteId: 'other' });
    expect(blocked.some((h) => h.includes('staging.client.com') || h === 'client.com')).toBe(true);
    expect(blocked.some((h) => h.includes('www.client.com') || h === 'client.com')).toBe(true);
  });
});
