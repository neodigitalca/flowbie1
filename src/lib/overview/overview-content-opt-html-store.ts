import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";

export type OverviewOptimizedUploadPayload = {
  html: string;
  link?: string;
};

/** Last Content Opt HTML (+ canonical link) by page URL for Overview row patch. */
const byUrlKey = new Map<string, OverviewOptimizedUploadPayload>();

export function storeOverviewOptimizedHtml(
  pageUrl: string,
  html: string,
  link?: string,
): void {
  const key = normalizePageUrlKey(pageUrl);
  const trimmed = (html ?? "").trim();
  if (!key || !trimmed) return;
  byUrlKey.set(key, {
    html: trimmed,
    ...(link?.trim() ? { link: link.trim() } : {}),
  });
}

export function consumeOverviewOptimizedUpload(
  pageUrl: string,
): OverviewOptimizedUploadPayload | undefined {
  const key = normalizePageUrlKey(pageUrl);
  if (!key) return undefined;
  const payload = byUrlKey.get(key);
  if (payload == null) return undefined;
  byUrlKey.delete(key);
  return payload;
}

export function peekOverviewOptimizedHtml(pageUrl: string): string | undefined {
  const key = normalizePageUrlKey(pageUrl);
  if (!key) return undefined;
  return byUrlKey.get(key)?.html;
}
