/**
 * Elementor API – fetch/update Elementor pages via backend Elementor-MCP proxy.
 */

import { backendApiUrl } from './wordpress-api/connection';
import { elementorPageTargetFromInput } from '@/lib/elementor-page-target';
import { getPublicSiteUrl } from '@/lib/wordpress-site-public-url';
import type { WordPressSite } from '@/components/integrations/types';

export interface ElementorPageResult {
  postId: number;
  meta: Record<string, unknown>;
  elementorData: unknown;
  rawElementorData?: string;
}

export type ElementorStatus = {
  novamira: boolean;
  elementor: boolean;
  frontPageId?: number;
};

function siteAuth(site: WordPressSite) {
  return {
    siteUrl: site.siteUrl,
    username: site.username,
    appPassword: site.appPassword,
  };
}

export function siteReadyForElementorApi(site: WordPressSite | undefined): site is WordPressSite {
  return Boolean(
    site?.siteUrl?.trim() && site?.username?.trim() && site?.appPassword?.trim(),
  );
}

function assertSiteAuth(site: WordPressSite): void {
  if (!siteReadyForElementorApi(site)) {
    throw new Error("WordPress site credentials are not configured.");
  }
}

async function postElementor<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(backendApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof (data as { error?: string }).error === 'string'
        ? (data as { error: string }).error
        : `Elementor request failed: ${res.status}`,
    );
  }
  return data as T;
}

export async function fetchElementorStatus(site: WordPressSite): Promise<ElementorStatus> {
  assertSiteAuth(site);
  const data = await postElementor<ElementorStatus>('/api/elementor/status', siteAuth(site));
  return {
    novamira: data.novamira === true,
    elementor: data.elementor === true,
    frontPageId: typeof data.frontPageId === 'number' ? data.frontPageId : undefined,
  };
}

/**
 * Map a page row value to a numeric page ID via Novamira only.
 * Does not call the WordPress post/entity URL resolver.
 */
export async function resolveElementorPageId(
  site: WordPressSite,
  pageIdOrUrl: string
): Promise<number> {
  const target = elementorPageTargetFromInput(pageIdOrUrl, getPublicSiteUrl(site));
  if (target.kind === "id") {
    return target.pageId;
  }
  const slug = target.kind === "front" ? "__front" : target.slug;
  const data = await postElementor<{ pageId?: number }>("/api/elementor/get-page-id-by-slug", {
    ...siteAuth(site),
    slug,
  });
  if (data.pageId == null) throw new Error("No front page is set on this WordPress site.");
  return Number(data.pageId);
}

/**
 * Fetch a page's Elementor data via Elementor-MCP get_page.
 */
export async function fetchElementorPage(
  site: WordPressSite,
  pageIdOrUrl: string
): Promise<ElementorPageResult> {
  assertSiteAuth(site);
  const pageId = await resolveElementorPageId(site, pageIdOrUrl);
  const pageData = await postElementor<{
    id?: number;
    meta?: Record<string, unknown>;
  }>('/api/elementor/get-page', {
    ...siteAuth(site),
    pageId,
  });
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
    throw new Error('Invalid _elementor_data JSON');
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
  const data = await postElementor<{ tools?: unknown }>('/api/elementor/tools', siteAuth(site));
  const tools = data.tools ?? [];
  return Array.isArray(tools) ? tools : [];
}

function firstElementorId(data: unknown): string {
  if (!Array.isArray(data) || !data[0] || typeof data[0] !== "object") return "";
  const id = (data[0] as { id?: unknown }).id;
  return id == null ? "" : String(id);
}

/**
 * Write Elementor JSON onto the live page and confirm _elementor_data changed.
 */
export async function applyElementorOptimization(
  site: WordPressSite,
  pageId: number,
  elementorDataJson: string,
  options?: { draft?: boolean }
): Promise<void> {
  let sent: unknown;
  try {
    sent = JSON.parse(elementorDataJson);
  } catch {
    throw new Error("elementor_data is not valid JSON.");
  }
  const wantId = firstElementorId(sent);
  const data = await postElementor<{ ok?: boolean; firstId?: string }>('/api/elementor/update-page', {
    ...siteAuth(site),
    pageId,
    elementor_data: elementorDataJson,
    draft: options?.draft === true,
  });
  if (data.ok !== true) {
    throw new Error("Elementor layout did not save on the live page.");
  }
  const page = await fetchElementorPage(site, String(pageId));
  const gotId = firstElementorId(page.elementorData);
  if (wantId && gotId !== wantId) {
    throw new Error(`Live Elementor data did not change on page ${pageId}.`);
  }
}
