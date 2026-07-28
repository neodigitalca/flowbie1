import { describe, it, expect } from 'vitest';
import {
  stripPlaceholderDomainLinks,
  isPlaceholderLinkHostname,
  isWikipediaLinkHostname,
} from '../placeholder-link-domains';

describe('isPlaceholderLinkHostname', () => {
  it('flags example.com and subdomains', () => {
    expect(isPlaceholderLinkHostname('example.com')).toBe(true);
    expect(isPlaceholderLinkHostname('www.example.com')).toBe(true);
    expect(isPlaceholderLinkHostname('foo.bar.example.com')).toBe(true);
  });

  it('flags other reserved example TLDs', () => {
    expect(isPlaceholderLinkHostname('example.org')).toBe(true);
    expect(isPlaceholderLinkHostname('sub.example.net')).toBe(true);
  });

  it('flags loopback', () => {
    expect(isPlaceholderLinkHostname('localhost')).toBe(true);
    expect(isPlaceholderLinkHostname('127.0.0.1')).toBe(true);
  });

  it('does not flag real sites', () => {
    expect(isPlaceholderLinkHostname('heritagedentaledmonton.ca')).toBe(false);
    expect(isPlaceholderLinkHostname('en.wikipedia.org')).toBe(false);
  });
});

describe('isWikipediaLinkHostname', () => {
  it('detects wikipedia', () => {
    expect(isWikipediaLinkHostname('en.wikipedia.org')).toBe(true);
  });
});

describe('stripPlaceholderDomainLinks', () => {
  it('strips markdown links to example.com, keeps text', () => {
    const input = 'See [guide](https://www.example.com/path/) for more.';
    expect(stripPlaceholderDomainLinks(input)).toBe('See guide for more.');
  });

  it('strips HTML links to example.com', () => {
    const input = '<p><a href="https://example.com/foo/">click</a></p>';
    expect(stripPlaceholderDomainLinks(input)).toBe('<p>click</p>');
  });

  it('preserves Wikipedia links', () => {
    const input = 'Read [wiki](https://en.wikipedia.org/wiki/Tent) here.';
    expect(stripPlaceholderDomainLinks(input)).toBe(input);
  });

  it('preserves real site links', () => {
    const input = '[Page](https://mysite.com/blog/post/)';
    expect(stripPlaceholderDomainLinks(input)).toBe(input);
  });
});
