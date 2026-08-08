const CHAT_FILE_URL = /\/api\/teams\/\d+\/chat\/channels\/\d+\/files\/\d+/;

export function extractUrlsFromHtml(html: string): string[] {
  const urls = new Set<string>();
  const bare = html.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  for (let url of bare) {
    url = url.replace(/[.,);]+$/, "");
    if (CHAT_FILE_URL.test(url)) continue;
    try {
      urls.add(new URL(url).href);
    } catch {
      // skip invalid
    }
  }
  const hrefs = html.match(/href=["']([^"']+)["']/gi) ?? [];
  for (const match of hrefs) {
    const inner = /href=["']([^"']+)["']/i.exec(match);
    const url = inner?.[1]?.trim();
    if (!url || !/^https?:\/\//i.test(url) || CHAT_FILE_URL.test(url)) continue;
    try {
      urls.add(new URL(url).href);
    } catch {
      // skip invalid
    }
  }
  return [...urls];
}
