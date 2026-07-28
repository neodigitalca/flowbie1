/**
 * Elementor API – fetch/update Elementor pages via backend Elementor-MCP proxy.
 */

import { BACKEND_API_BASE } from './wordpress-api/connection';
import { resolveWordPressUrls } from './wordpress-api/posts';
import type { WordPressSite } from '@/components/integrations/types';

export interface ElementorPageResult {
  postId: number;
  meta: Record<string, unknown>;
  elementorData: unknown;
  rawElementorData?: string;
}

/**
 * Resolve page URL or slug to numeric page ID.
 * - If input looks like a URL: uses resolve-urls, returns first resolved id (must be a page).
 * - If input is numeric: returns it as number.
 * - Otherwise: treats as slug and calls /api/elementor/get-page-id-by-slug.
 */
async function resolveToPageId(
  site: WordPressSite,
  pageIdOrUrl: string
): Promise<number> {
  const trimmed = pageIdOrUrl.trim();
  const numeric = parseInt(trimmed, 10);
  if (!Number.isNaN(numeric) && String(numeric) === trimmed) {
    return numeric;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const result = await resolveWordPressUrls(
      site.siteUrl,
      site.username,
      site.appPassword,
      [trimmed]
    );
    if (!result.resolved?.length) {
      throw new Error(
        result.unresolvable?.[0]?.reason || 'Could not resolve page URL'
      );
    }
    return result.resolved[0].id;
  }
  const slug = trimmed.replace(/^\//, '').replace(/\/$/, '') || trimmed;
  const url = `${BACKEND_API_BASE}/api/elementor/get-page-id-by-slug`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siteUrl: site.siteUrl,
      username: site.username,
      appPassword: site.appPassword,
      slug,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to resolve slug: ${res.status}`);
  }
  const data = await res.json();
  if (data.pageId == null) throw new Error('No pageId in response');
  return Number(data.pageId);
}

/**
 * Fetch a page's Elementor data via Elementor-MCP get_page.
 */
export async function fetchElementorPage(
  site: WordPressSite,
  pageIdOrUrl: string
): Promise<ElementorPageResult> {
  const pageId = await resolveToPageId(site, pageIdOrUrl);
  const url = `${BACKEND_API_BASE}/api/elementor/get-page`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siteUrl: site.siteUrl,
      username: site.username,
      appPassword: site.appPassword,
      pageId,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to get page: ${res.status}`);
  }
  const pageData = await res.json();
  const meta = pageData.meta || {};
  let raw = meta._elementor_data;
  if (raw == null || raw === '') {
    throw new Error('This page is not built with Elementor (no _elementor_data).');
  }
  if (typeof raw !== 'string') raw = JSON.stringify(raw);
  let elementorData: unknown;
  try {
    elementorData = JSON.parse(raw);
  } catch {
    try {
      elementorData = JSON.parse(JSON.parse(raw));
    } catch {
      throw new Error('Invalid _elementor_data JSON');
    }
  }
  return {
    postId: pageData.id ?? pageId,
    meta,
    elementorData,
    rawElementorData: raw,
  };
}

/**
 * Fetch the list of tools exposed by the Elementor MCP server (for optimizer context).
 */
export async function fetchElementorMcpTools(
  site: WordPressSite
): Promise<{ name: string; description?: string; inputSchema?: unknown }[]> {
  const url = `${BACKEND_API_BASE}/api/elementor/tools`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siteUrl: site.siteUrl,
      username: site.username,
      appPassword: site.appPassword,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to list Elementor MCP tools');
  }
  const data = await res.json();
  const tools = data.tools ?? [];
  return Array.isArray(tools) ? tools : [];
}

/**
 * Apply optimized Elementor data to a page via Elementor-MCP update_page.
 */
export async function applyElementorOptimization(
  site: WordPressSite,
  pageId: number,
  elementorDataJson: string
): Promise<void> {
  const url = `${BACKEND_API_BASE}/api/elementor/update-page`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siteUrl: site.siteUrl,
      username: site.username,
      appPassword: site.appPassword,
      pageId,
      elementor_data: elementorDataJson,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update page: ${res.status}`);
  }
}
