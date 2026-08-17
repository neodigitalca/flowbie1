/**
 * Clear WordPress posts/pages/media via REST (optional if credentials provided).
 * Falls back to PHP clear on plugin activation when credentials are missing.
 */
export async function clearWpStagingContent({ siteUrl, username, appPassword }) {
  if (!siteUrl || !username || !appPassword) {
    console.log("  WP REST clear skipped (no app password). Plugin activation will clear WP content.");
    return;
  }

  const base = siteUrl.replace(/\/$/, "");
  const auth = Buffer.from(`${username}:${appPassword}`).toString("base64");
  const headers = { Authorization: `Basic ${auth}` };

  for (const type of ["posts", "pages", "media"]) {
    let page = 1;
    for (;;) {
      const res = await fetch(`${base}/wp-json/wp/v2/${type}?per_page=100&page=${page}&status=any`, { headers });
      if (!res.ok) break;
      const items = await res.json();
      if (!Array.isArray(items) || items.length === 0) break;
      for (const item of items) {
        await fetch(`${base}/wp-json/wp/v2/${type}/${item.id}?force=true`, { method: "DELETE", headers });
      }
      if (items.length < 100) break;
      page += 1;
    }
  }
}
