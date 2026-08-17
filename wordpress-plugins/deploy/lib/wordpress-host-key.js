/** Normalize URL/host to lowercase domain without www. */
export function wordPressSiteHostKeyFromUrl(url) {
  const raw = String(url ?? "").trim();
  if (!raw) return "";
  let host = raw;
  if (host.includes("://")) {
    try {
      host = new URL(host).hostname;
    } catch {
      host = host.replace(/^https?:\/\//i, "").split("/")[0];
    }
  }
  host = host.replace(/^www\./i, "").replace(/\/+$/, "").toLowerCase();
  return host;
}
