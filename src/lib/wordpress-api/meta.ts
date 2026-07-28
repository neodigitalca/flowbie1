/**
 * WordPress API Meta Module
 * Functions for getting and updating WordPress post meta fields
 */

import { BACKEND_API_BASE, BACKEND_CONNECTION_ERROR } from './connection';
import type { OverviewBulkSeoApiItem } from '@/lib/overview/overview-bulk-seo-payload';
import type {
  WordPressPostMetaResult,
  WordPressPostMetaUpdateResult
} from './types';

export type { OverviewBulkSeoApiItem };

export type BulkOverviewSeoResultRow = {
  postId: number | null;
  index?: number;
  ok: boolean;
  error?: string;
  method?: string;
  mergeError?: string;
  httpStatus?: number | null;
  /** Canonical permalink returned by WordPress after a content PUT. */
  link?: string;
};

export type BulkOverviewSeoResponse = {
  success: boolean;
  results: BulkOverviewSeoResultRow[];
  okCount: number;
  total: number;
  error?: string;
};

/** Max items per client bulk-update-overview-seo request. */
export const BULK_OVERVIEW_SEO_MAX_ITEMS = 500;

/**
 * Get WordPress post with all meta fields
 * 
 * @param siteUrl - WordPress site URL
 * @param username - WordPress username
 * @param appPassword - WordPress Application Password
 * @param postId - Post ID to fetch
 * @param postType - Post type (default: 'post') - internal type for function signature
 * @param postTypeEndpoint - Optional actual WordPress REST API endpoint name (e.g., 'posts', 'service-areas') - use exact endpoint from scraped post
 * 
 * @returns Promise resolving to WordPressPostMetaResult with all meta fields
 * 
 * @throws Error if authentication fails, site is unreachable, or backend server is not running
 */
export async function getWordPressPostMeta(
  siteUrl: string,
  username: string,
  appPassword: string,
  postId: number,
  postType: string = 'post',
  postTypeEndpoint?: string // Actual WordPress REST API endpoint name from scraped post
): Promise<WordPressPostMetaResult> {
  const url = `${BACKEND_API_BASE}/api/wordpress/get-post-meta`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        siteUrl,
        username,
        appPassword,
        postId,
        postType,
        postTypeEndpoint, // Pass the exact endpoint from scraped post
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(BACKEND_CONNECTION_ERROR);
    }
    
    throw error;
  }
}

/**
 * Update WordPress post meta fields
 * 
 * @param siteUrl - WordPress site URL
 * @param username - WordPress username
 * @param appPassword - WordPress Application Password
 * @param postId - Post ID to update
 * @param postType - Post type (default: 'post')
 * @param postTypeEndpoint - Optional actual WordPress REST API endpoint name from scraped post
 * @param meta - Object containing meta fields to update
 * 
 * @returns Promise resolving to WordPressPostMetaUpdateResult with update status
 * 
 * @throws Error if authentication fails, site is unreachable, or backend server is not running
 */
export async function updateWordPressPostMeta(
  siteUrl: string,
  username: string,
  appPassword: string,
  postId: number,
  postType: string = 'post',
  postTypeEndpoint?: string, // Actual WordPress REST API endpoint name from scraped post
  meta: Record<string, any>
): Promise<WordPressPostMetaUpdateResult> {
  const url = `${BACKEND_API_BASE}/api/wordpress/update-post-meta`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        siteUrl,
        username,
        appPassword,
        postId,
        postType,
        postTypeEndpoint, // Pass the exact endpoint from scraped post
        meta,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(BACKEND_CONNECTION_ERROR);
    }
    
    throw error;
  }
}

export async function updateOverviewSeoItem(
  siteUrl: string,
  username: string,
  appPassword: string,
  item: OverviewBulkSeoApiItem,
): Promise<BulkOverviewSeoResultRow> {
  const url = `${BACKEND_API_BASE}/api/wordpress/update-overview-seo-item`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        siteUrl,
        username,
        appPassword,
        item,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as BulkOverviewSeoResultRow & {
      error?: string;
    };

    if (!response.ok) {
      return {
        postId: item.postId,
        ok: false,
        error: data.error || `HTTP ${response.status}`,
        httpStatus: response.status,
      };
    }

    return {
      postId: data.postId ?? item.postId,
      ok: Boolean(data.ok),
      error: data.error,
      method: data.method,
      mergeError: data.mergeError,
      httpStatus: data.httpStatus ?? null,
    };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(BACKEND_CONNECTION_ERROR);
    }
    throw error;
  }
}

export type BulkOverviewSeoProgressEvent = {
  done: number;
  total: number;
  wpBatch: number;
  wpBatchCount: number;
  batchResults: BulkOverviewSeoResultRow[];
};

export type BulkUpdateOverviewSeoOptions = {
  onProgress?: (event: BulkOverviewSeoProgressEvent) => void;
};

async function consumeBulkOverviewSeoNdjson(
  body: ReadableStream<Uint8Array>,
  onProgress?: BulkUpdateOverviewSeoOptions["onProgress"],
): Promise<BulkOverviewSeoResponse> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResponse: BulkOverviewSeoResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed) as {
          type: string;
          done?: number;
          total?: number;
          wpBatch?: number;
          wpBatchCount?: number;
          batchResults?: BulkOverviewSeoResultRow[];
          success?: boolean;
          results?: BulkOverviewSeoResultRow[];
          okCount?: number;
          error?: string;
        };
        if (
          obj.type === "progress" &&
          typeof obj.done === "number" &&
          typeof obj.total === "number" &&
          typeof obj.wpBatch === "number" &&
          typeof obj.wpBatchCount === "number" &&
          Array.isArray(obj.batchResults)
        ) {
          onProgress?.({
            done: obj.done,
            total: obj.total,
            wpBatch: obj.wpBatch,
            wpBatchCount: obj.wpBatchCount,
            batchResults: obj.batchResults,
          });
        } else if (obj.type === "done" && Array.isArray(obj.results)) {
          finalResponse = {
            success: Boolean(obj.success),
            results: obj.results,
            okCount: obj.okCount ?? obj.results.filter((r) => r.ok).length,
            total: obj.total ?? obj.results.length,
            error: obj.error,
          };
        }
      } catch {
        // skip malformed line
      }
    }
    if (done) break;
  }

  if (buffer.trim()) {
    try {
      const obj = JSON.parse(buffer.trim()) as {
        type: string;
        success?: boolean;
        results?: BulkOverviewSeoResultRow[];
        okCount?: number;
        total?: number;
        error?: string;
      };
      if (obj.type === "done" && Array.isArray(obj.results)) {
        finalResponse = {
          success: Boolean(obj.success),
          results: obj.results,
          okCount: obj.okCount ?? obj.results.filter((r) => r.ok).length,
          total: obj.total ?? obj.results.length,
          error: obj.error,
        };
      }
    } catch {
      // ignore
    }
  }

  if (!finalResponse) {
    throw new Error("WordPress bulk upload ended without a done payload.");
  }
  return finalResponse;
}

export async function bulkUpdateOverviewSeo(
  siteUrl: string,
  username: string,
  appPassword: string,
  items: OverviewBulkSeoApiItem[],
  options?: BulkUpdateOverviewSeoOptions,
): Promise<BulkOverviewSeoResponse> {
  if (items.length > BULK_OVERVIEW_SEO_MAX_ITEMS) {
    throw new Error(
      `bulkUpdateOverviewSeo accepts at most ${BULK_OVERVIEW_SEO_MAX_ITEMS} items per call (got ${items.length}). Chunk uploads before calling.`,
    );
  }

  const url = `${BACKEND_API_BASE}/api/wordpress/bulk-update-overview-seo`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        siteUrl,
        username,
        appPassword,
        items,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      let errData: { error?: string } = {};
      try {
        errData = JSON.parse(errText) as { error?: string };
      } catch {
        // not json
      }
      throw new Error(errData.error || errText || `HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("ndjson") && response.body) {
      const out = await consumeBulkOverviewSeoNdjson(response.body, options?.onProgress);
      const sanitizedResults = (out.results || []).map((r) => {
        if (!r.error) return r;
        const e = r.error;
        if (
          e.includes("<!DOCTYPE") ||
          e.toLowerCase().includes("<html") ||
          e.toLowerCase().includes("attention required")
        ) {
          return {
            ...r,
            error:
              "Cloudflare blocked the WordPress REST response (HTML challenge page). Allow /wp-json/* or whitelist the Flowbie server IP.",
          };
        }
        return r;
      });
      return { ...out, results: sanitizedResults };
    }

    const data = (await response.json().catch(() => ({}))) as BulkOverviewSeoResponse & {
      error?: string;
    };
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(BACKEND_CONNECTION_ERROR);
    }
    throw error;
  }
}
