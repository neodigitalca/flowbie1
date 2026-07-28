/** Character cap for every WordPress site URL label (tile, header, bulk import, etc.). */
export const WORDPRESS_SITE_URL_LABEL_MAX_CHARS = 36;

/** Hostname only, for link labels (href should stay the full stored URL). */
export function wordpressSiteDomainLabel(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.replace(/^https?:\/\//i, "").split("/")[0] || url;
  }
}

export function truncateWordpressSiteUrlLabel(text: string): string {
  const max = WORDPRESS_SITE_URL_LABEL_MAX_CHARS;
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}
