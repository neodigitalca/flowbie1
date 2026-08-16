/**
 * Direct WordPress REST calls from the browser (same TLS and IP as normal browsing).
 * Helps when the Node backend is blocked by host bot protection (e.g. SiteGround sgcaptcha).
 *
 * Requires the WordPress site to allow this app origin on REST (CORS). If CORS is not
 * configured, fetch fails with a network error and callers may fall back to the backend.
 */

import type { PublishedPostsResult } from './types';

export const WORDPRESS_SGCAPTCHA_BLOCKED_HINT =
  'SiteGround blocked WordPress REST (sgcaptcha). Allowlist your NEO Pulse IP in Site Tools, relax bot checks for /wp-json/, or enable CORS on WordPress so the NEO Pulse app can call /wp-json/ from the browser.';

/**
 * Example must-use plugin: allow NEO Pulse dev origins to call /wp-json with Authorization.
 * Add your production NEO Pulse origin to $allowed. Remove or tighten when not needed.
 */
export const NEO_PULSE_WORDPRESS_MU_PLUGIN_CORS_EXAMPLE = `<?php
/**
 * Plugin Name: NEO Pulse REST CORS
 * Description: CORS for NEO Pulse browser REST. Edit $allowed for your origins.
 */
add_action('rest_api_init', function () {
  remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
  add_filter('rest_pre_serve_request', function ($served, $result, $request, $server) {
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
    $allowed = array(
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    );
    if (in_array($origin, $allowed, true)) {
      header('Access-Control-Allow-Origin: ' . $origin);
      header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
      header('Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce');
      header('Access-Control-Allow-Credentials: true');
    }
    return $served;
  }, 11, 4);
});
`;

export function normalizeWpSiteOrigin(siteUrl: string): string {
  let u = siteUrl.trim();
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    u = `https://${u}`;
  }
  return u.replace(/\/$/, '');
}

function basicAuthHeader(username: string, appPassword: string): string {
  const pair = `${username}:${appPassword}`;
  const bytes = new TextEncoder().encode(pair);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return `Basic ${btoa(bin)}`;
}

function mapPublishedPost(
  post: Record<string, unknown>,
  normalizedOrigin: string,
): {
  id: number;
  slug: string;
  title: string;
  date_gmt: string;
  excerpt: string;
  link: string;
} {
  const tr = post.title;
  const title =
    tr && typeof tr === 'object' && tr !== null && 'rendered' in tr
      ? String((tr as { rendered?: string }).rendered ?? 'Untitled')
      : String(tr ?? 'Untitled');
  const ex = post.excerpt;
  const excerpt =
    ex && typeof ex === 'object' && ex !== null && 'rendered' in ex
      ? String((ex as { rendered?: string }).rendered ?? '')
      : String(ex ?? '');
  const slug = String(post.slug ?? `post-${post.id}`);
  return {
    id: Number(post.id),
    slug,
    title,
    date_gmt: String(post.date_gmt ?? ''),
    excerpt,
    link: String(post.link ?? `${normalizedOrigin}/${slug}`),
  };
}

function isSgcaptchaPayload(status: number, bodyText: string): boolean {
  if (status === 202 && bodyText.includes('sgcaptcha')) return true;
  if (bodyText.includes('sgcaptcha')) return true;
  return false;
}

async function wpJsonGet(
  restUrl: string,
  username: string,
  appPassword: string,
): Promise<{ response: Response; text: string }> {
  const response = await fetch(restUrl, {
    method: 'GET',
    headers: {
      Authorization: basicAuthHeader(username, appPassword),
      Accept: 'application/json',
    },
  });
  const text = await response.text();
  return { response, text };
}

/** True: try browser first. Set VITE_WORDPRESS_BROWSER_REST=0 to force backend-only. */
export function shouldTryBrowserWpRestFirst(): boolean {
  if (import.meta.env.VITE_WORDPRESS_BROWSER_REST === '0') return false;
  return typeof window !== 'undefined';
}

export function isLikelyCorsOrNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('load failed') ||
    m.includes('network request failed')
  );
}

export async function getPublishedPostsFromBrowser(
  siteUrl: string,
  username: string,
  appPassword: string,
  limit: number = 100,
  offset: number = 0,
): Promise<PublishedPostsResult> {
  const origin = normalizeWpSiteOrigin(siteUrl);
  const maxPosts = limit;
  let page = Math.floor(offset / 100) + 1;
  const allPosts: PublishedPostsResult['posts'] = [];
  let hasMore = true;

  while (hasMore && allPosts.length < maxPosts) {
    const perPage = Math.min(100, maxPosts - allPosts.length);
    const q = new URLSearchParams({
      status: 'publish',
      per_page: String(perPage),
      page: String(page),
      _fields: 'id,slug,title,date_gmt,excerpt,link',
    });
    const restUrl = `${origin}/wp-json/wp/v2/posts?${q}`;

    const { response, text } = await wpJsonGet(restUrl, username, appPassword);

    if (isSgcaptchaPayload(response.status, text)) {
      throw new Error(WORDPRESS_SGCAPTCHA_BLOCKED_HINT);
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          'Authentication failed. Verify username and application password.',
        );
      }
      throw new Error(`WordPress REST error: ${response.status}`);
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('WordPress returned invalid JSON for the post list.');
    }

    if (!Array.isArray(data)) {
      if (data && typeof data === 'object' && 'message' in data) {
        throw new Error(String((data as { message: unknown }).message));
      }
      throw new Error('Unexpected WordPress REST response for posts.');
    }

    if (data.length === 0) {
      hasMore = false;
      break;
    }

    for (const raw of data) {
      if (raw && typeof raw === 'object') {
        allPosts.push(mapPublishedPost(raw as Record<string, unknown>, origin));
      }
    }

    const totalPages = parseInt(response.headers.get('x-wp-totalpages') ?? '1', 10);
    if (page >= totalPages || data.length < 100 || allPosts.length >= maxPosts) {
      hasMore = false;
    } else {
      page += 1;
    }
  }

  const offsetPosts = allPosts.slice(offset % 100);
  return {
    count: offsetPosts.length,
    posts: offsetPosts,
    total: allPosts.length,
  };
}

export async function getPublishedPagesFromBrowser(
  siteUrl: string,
  username: string,
  appPassword: string,
  limit: number = 100,
  offset: number = 0,
): Promise<PublishedPostsResult> {
  const origin = normalizeWpSiteOrigin(siteUrl);
  const pageNum = Math.floor(offset / 100) + 1;
  const perPage = Math.min(limit, 100);
  const q = new URLSearchParams({
    per_page: String(perPage),
    page: String(pageNum),
    status: 'publish',
    _fields: 'id,slug,title,date_gmt,excerpt,link,status,type,post_type',
  });
  const restUrl = `${origin}/wp-json/wp/v2/pages?${q}`;

  const { response, text } = await wpJsonGet(restUrl, username, appPassword);

  if (isSgcaptchaPayload(response.status, text)) {
    throw new Error(WORDPRESS_SGCAPTCHA_BLOCKED_HINT);
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        'Authentication failed. Verify username and application password.',
      );
    }
    throw new Error(`WordPress REST error: ${response.status}`);
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('WordPress returned invalid JSON for the page list.');
  }

  if (!Array.isArray(data)) {
    if (data && typeof data === 'object' && 'message' in data) {
      throw new Error(String((data as { message: unknown }).message));
    }
    throw new Error('Unexpected WordPress REST response for pages.');
  }

  const total = parseInt(response.headers.get('x-wp-total') ?? String(data.length), 10);
  const posts = data.map((raw) =>
    raw && typeof raw === 'object'
      ? mapPublishedPost(raw as Record<string, unknown>, origin)
      : null,
  ).filter(Boolean) as PublishedPostsResult['posts'];

  return {
    count: posts.length,
    posts,
    total: Number.isFinite(total) ? total : posts.length,
  };
}
