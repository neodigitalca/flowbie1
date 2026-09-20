/**
 * Unified fields client — routes reads/discovery by site capabilities (ACF vs NEO Pulse Fields).
 * Keeps existing /get-acf-fields REST routes for batch performance; uses NEO Pulse WP tools when needed.
 */

import type { WordPressSite } from '@/components/integrations/types';
import {
  discoverACFFieldGroups,
  getACFFieldsForPost,
  getACFFieldsForPostsBatch,
  getACFFieldsForUrlsBatch,
  siteSupportsSeoExtraTextAcf,
  type ACFDiscoveryResult,
  type WpPostSnapshotFromAcfByUrl,
} from './acf-discovery';
import {
  getNeoPulseSiteIndex,
  resolveNeoPulseUrl,
  siteHasNeoPulseWp,
  type NeoPulseSiteIndexItem,
} from './neo-pulse-wp-tools';

export type { ACFDiscoveryResult, WpPostSnapshotFromAcfByUrl };

export {
  siteSupportsSeoExtraTextAcf,
  siteHasNeoPulseWp,
};

function asRestFieldObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** Plugin fields win when they have a non-empty value (Rank Math / NEO Pulse over stale ACF). */
export function mergeRestFieldObjects(
  acf: Record<string, unknown> | null | undefined,
  plugin: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(acf ?? {}) };
  if (!plugin) return merged;
  for (const [key, value] of Object.entries(plugin)) {
    const pluginText =
      typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
    const existing = merged[key];
    const existingText =
      typeof existing === "string" || typeof existing === "number" ? String(existing).trim() : "";
    if (pluginText || existingText === "") {
      merged[key] = value;
    }
  }
  return merged;
}

/** Extract custom fields from a WP REST full post (acf merged with neo_pulse_fields). */
export function restAcfFromFullPost(
  fullPost: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!fullPost || typeof fullPost !== "object") return {};
  const acf = asRestFieldObject(fullPost.acf);
  const neoPulseFields = asRestFieldObject(fullPost.neo_pulse_fields);
  if (!acf && !neoPulseFields) return {};
  return mergeRestFieldObjects(acf, neoPulseFields);
}

export function siteUsesNeoPulseFieldsBackend(site: WordPressSite): boolean {
  return (
    site.capabilities?.fieldsBackend === 'neo_pulse_fields' ||
    (siteHasNeoPulseWp(site) && site.capabilities?.acfRestObjectPresent !== false)
  );
}

/** Discover field groups — server picks NEO Pulse export vs ACF REST vs sample scan. */
export async function discoverFieldGroups(
  site: WordPressSite,
  postType?: string,
  postTypeEndpoint?: string,
  sampleSize = 10,
): Promise<ACFDiscoveryResult> {
  return discoverACFFieldGroups(site, postType, postTypeEndpoint, sampleSize);
}

export async function getFieldsForPost(
  site: WordPressSite,
  postId: number,
  postType?: string,
  postTypeEndpoint?: string,
) {
  return getACFFieldsForPost(site, postId, postType, postTypeEndpoint);
}

export async function getFieldsForPostsBatch(
  site: WordPressSite,
  items: Array<{ postId: number; postType?: string; postTypeEndpoint?: string }>,
) {
  return getACFFieldsForPostsBatch(site, items);
}

export async function getFieldsForUrlsBatch(
  site: WordPressSite,
  items: Array<{ url: string; postType?: string; postTypeEndpoint?: string }>,
) {
  return getACFFieldsForUrlsBatch(site, items);
}

let __siteIndexCache = new Map<string, { at: number; items: NeoPulseSiteIndexItem[] }>();
const SITE_INDEX_TTL_MS = 5 * 60 * 1000;

/**
 * Cached wp_site_index for NEO Pulse WP sites (Content Optimizer / Overview mirror).
 */
export async function getSiteMirrorIndex(
  site: WordPressSite,
  options?: { limit?: number; forceRefresh?: boolean },
): Promise<NeoPulseSiteIndexItem[]> {
  if (!siteHasNeoPulseWp(site)) return [];
  const key = site.id || site.siteUrl;
  const cached = __siteIndexCache.get(key);
  if (!options?.forceRefresh && cached && Date.now() - cached.at < SITE_INDEX_TTL_MS) {
    return cached.items;
  }
  const result = await getNeoPulseSiteIndex(site, { limit: options?.limit ?? 500 });
  if (result.ok && result.items.length) {
    __siteIndexCache.set(key, { at: Date.now(), items: result.items });
    return result.items;
  }
  return cached?.items ?? [];
}

/** Clear mirror cache (e.g. after site reconnect). */
export function clearSiteMirrorIndexCache(siteId?: string): void {
  if (siteId) {
    __siteIndexCache.delete(siteId);
    return;
  }
  __siteIndexCache = new Map();
}

/**
 * Resolve URL → post id using NEO Pulse WP when available, else null (caller uses REST resolve).
 */
export async function resolvePostUrlViaMirror(
  site: WordPressSite,
  url: string,
): Promise<number | null> {
  if (!siteHasNeoPulseWp(site)) return null;
  try {
    const resolved = await resolveNeoPulseUrl(site, url);
    if (resolved?.postId) return resolved.postId;
  } catch {
    // fall through to index lookup
  }
  const index = await getSiteMirrorIndex(site);
  const norm = url.trim().replace(/\/+$/, '').toLowerCase();
  for (const item of index) {
    const itemUrl = typeof item.url === 'string' ? item.url.replace(/\/+$/, '').toLowerCase() : '';
    if (itemUrl && itemUrl === norm) {
      return Number(item.id);
    }
  }
  return null;
}

/** Merge wp_site_index focus_keyword into inventory-style keyword when REST inventory missed it. */
export function mergeMirrorIndexIntoInventoryKeyword(
  site: WordPressSite,
  url: string,
  existingKeyword: string,
  index: NeoPulseSiteIndexItem[],
): string {
  if (existingKeyword.trim()) return existingKeyword;
  if (!siteHasNeoPulseWp(site) || !index.length) return existingKeyword;
  const norm = url.trim().replace(/\/+$/, '').toLowerCase();
  for (const item of index) {
    const itemUrl = typeof item.url === 'string' ? item.url.replace(/\/+$/, '').toLowerCase() : '';
    if (itemUrl === norm && typeof item.focus_keyword === 'string' && item.focus_keyword.trim()) {
      return item.focus_keyword.trim();
    }
  }
  return existingKeyword;
}
