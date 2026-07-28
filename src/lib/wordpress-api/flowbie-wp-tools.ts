/**
 * Flowbie WP tools client — same HTTP surface as flowbie-wp-mcp (via Node proxy).
 */

import { BACKEND_API_BASE } from './connection';
import type { WordPressSite } from '@/components/integrations/types';

export type FlowbieWpToolResult = Record<string, unknown> & {
  ok?: boolean;
  error?: string;
  data?: unknown;
};

function siteAuthBody(site: WordPressSite) {
  return {
    siteUrl: site.siteUrl,
    siteId: site.id,
    username: site.username,
    appPassword: site.appPassword,
  };
}

/**
 * Execute a Flowbie WP plugin tool (POST /flowbie/v1/tools/execute on WordPress).
 */
export async function executeFlowbieWpTool(
  site: WordPressSite,
  tool: string,
  params: Record<string, unknown> = {},
  options?: { idempotencyKey?: string; trustedAgent?: boolean },
): Promise<FlowbieWpToolResult> {
  const url = `${BACKEND_API_BASE}/api/wordpress/flowbie-wp-tool`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...siteAuthBody(site),
      tool,
      params,
      idempotency_key: options?.idempotencyKey,
      trusted_agent: options?.trustedAgent,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (typeof data.error === 'string' && data.error) ||
        (typeof data.message === 'string' && data.message) ||
        `Flowbie WP tool failed (HTTP ${response.status})`,
    );
  }
  return data as FlowbieWpToolResult;
}

/** List tools exposed by the Flowbie WP plugin (Tool Library / MCP catalog). */
export async function listFlowbieWpTools(site: WordPressSite): Promise<FlowbieWpToolResult> {
  const url = `${BACKEND_API_BASE}/api/wordpress/flowbie-wp-tools-list`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(siteAuthBody(site)),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (typeof data.error === 'string' && data.error) ||
        `tools/list failed (HTTP ${response.status})`,
    );
  }
  return data as FlowbieWpToolResult;
}

export type FlowbieSiteIndexItem = {
  id: number;
  title?: string;
  url?: string;
  excerpt?: string;
  type?: string;
  status?: string;
  focus_keyword?: string;
  has_seo_research?: boolean;
  modified?: string;
};

/** Agent site index with focus keyword and seo_research flags. */
export async function getFlowbieSiteIndex(
  site: WordPressSite,
  options?: { limit?: number; includeDrafts?: boolean },
): Promise<{ ok: boolean; items: FlowbieSiteIndexItem[]; count?: number; error?: string }> {
  const result = await executeFlowbieWpTool(site, 'wp_site_index', {
    limit: options?.limit ?? 500,
    include_drafts: options?.includeDrafts ?? false,
  });
  const items = Array.isArray(result.items)
    ? (result.items as FlowbieSiteIndexItem[])
    : Array.isArray((result.data as { items?: unknown })?.items)
      ? ((result.data as { items: FlowbieSiteIndexItem[] }).items)
      : [];
  if (result.ok === false) {
    return { ok: false, items: [], error: typeof result.error === 'string' ? result.error : undefined };
  }
  return {
    ok: true,
    items,
    count: typeof result.count === 'number' ? result.count : items.length,
  };
}

/** Search agent site index by keyword. */
export async function searchFlowbieSiteIndex(
  site: WordPressSite,
  query: string,
  limit = 8,
): Promise<{ ok: boolean; items: FlowbieSiteIndexItem[]; query?: string }> {
  const result = await executeFlowbieWpTool(site, 'wp_site_index_search', { query, limit });
  const items = Array.isArray(result.items)
    ? (result.items as FlowbieSiteIndexItem[])
    : [];
  return { ok: result.ok !== false, items, query };
}

/** Get Flowbie custom fields for a post. */
export async function getFlowbieFields(
  site: WordPressSite,
  postId: number,
  field?: string,
): Promise<Record<string, unknown>> {
  const params: Record<string, unknown> = { post_id: postId };
  if (field) params.field = field;
  const result = await executeFlowbieWpTool(site, 'wp_fields_get', params);
  if (field && result.value !== undefined) {
    return { [field]: result.value };
  }
  if (result.fields && typeof result.fields === 'object') {
    return result.fields as Record<string, unknown>;
  }
  return {};
}

/** Resolve a public URL to post_id. */
export async function resolveFlowbieUrl(
  site: WordPressSite,
  url: string,
): Promise<{ postId: number; url: string } | null> {
  const result = await executeFlowbieWpTool(site, 'wp_resolve_url', { url });
  const postId = Number(result.post_id);
  if (!Number.isFinite(postId) || postId < 1) return null;
  return {
    postId,
    url: typeof result.url === 'string' ? result.url : url,
  };
}

/** Rendered post content from Flowbie WP (GET /flowbie/v1/post-content/{id}). */
export async function getFlowbiePostContent(
  site: WordPressSite,
  postId: number,
): Promise<Record<string, unknown> | null> {
  const result = await executeFlowbieWpTool(site, 'wp_get_post_content', { post_id: postId });
  if (result.post && typeof result.post === 'object') {
    return result.post as Record<string, unknown>;
  }
  return null;
}

/** Tool names and risk levels from the MCP registry (static catalog for UI). */
export const FLOWBIE_WP_TOOL_CATALOG: ReadonlyArray<readonly [string, string, string]> = [
  ['wp_ping', 'read', 'Check Flowbie WP plugin is reachable'],
  ['wp_site_index', 'read', 'Site content graph index'],
  ['wp_site_index_search', 'read', 'Search site index by query'],
  ['wp_fields_list_groups', 'read', 'List Flowbie field groups'],
  ['wp_fields_get', 'read', 'Get Flowbie custom fields for a post'],
  ['wp_fields_update', 'write', 'Update a Flowbie field'],
  ['wp_fields_export_json', 'read', 'Export field groups JSON'],
  ['wp_resolve_url', 'read', 'Resolve URL to post_id'],
  ['wp_get_post_content', 'read', 'Get rendered post content'],
  ['wp_ai_optimize_meta_bundle', 'write', 'Optimize title/meta/excerpt bundle'],
];

export function siteHasFlowbieWp(site: WordPressSite): boolean {
  return site.capabilities?.hasFlowbieWp === true;
}
