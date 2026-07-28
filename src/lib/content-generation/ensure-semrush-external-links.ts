/**
 * Semrush-approved external URLs are woven into HTML by the content model (system/user prompts),
 * not by templated injection. Helpers remain for metrics; upload pass-through does not modify HTML.
 */

/** How many distinct Semrush URLs we aim to place (3–5 when enough exist; all when fewer). */
export function targetSemrushExternalDistinctCount(urlCount: number): number {
  if (urlCount <= 0) return 0;
  if (urlCount <= 2) return urlCount;
  return Math.min(5, urlCount);
}

export function urlAppearsInHtml(html: string, url: string): boolean {
  const h = html;
  const norm = url.trim().replace(/&amp;/g, "&");
  if (h.includes(norm)) return true;
  const low = h.toLowerCase();
  return low.includes(norm.toLowerCase());
}

/**
 * Previously injected boilerplate &lt;p&gt; after &lt;/h2&gt; (bad UX). Outbound Semrush links must be
 * written by the model per blueprint: neutral reference / knowledge-base style in running prose.
 * This function returns HTML unchanged so uploads still rely on prompts + sanitizer allowlist.
 */
export function ensureSemrushExternalLinksInHtml(html: string, _semrushExternalUrls: string[] | undefined): string {
  return html ?? "";
}
