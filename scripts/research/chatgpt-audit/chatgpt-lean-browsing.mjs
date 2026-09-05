/** @typedef {import("puppeteer").Page} PuppeteerPage */

const BLOCKED_RESOURCE_TYPES = new Set(["image", "media", "font"]);

const BLOCKED_HOST_SUFFIXES = [
  "google-analytics.com",
  "googletagmanager.com",
  "doubleclick.net",
  "facebook.net",
  "facebook.com",
  "hotjar.com",
  "segment.io",
  "segment.com",
  "mixpanel.com",
  "ingest.sentry.io",
  "sentry.io",
];

/**
 * @param {string} url
 * @param {string} resourceType
 */
export function shouldAbortChatGptProxyRequest(url, resourceType) {
  const type = String(resourceType ?? "").toLowerCase();
  if (BLOCKED_RESOURCE_TYPES.has(type)) return true;

  let hostname = "";
  try {
    hostname = new URL(String(url ?? "")).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (!hostname) return false;

  for (const suffix of BLOCKED_HOST_SUFFIXES) {
    if (hostname === suffix || hostname.endsWith(`.${suffix}`)) return true;
  }
  return false;
}

/** @param {PuppeteerPage} page */
export async function enableChatGptLeanBrowsing(page) {
  if (page.__chatGptLeanBrowsingEnabled) return;
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (shouldAbortChatGptProxyRequest(request.url(), request.resourceType())) {
      void request.abort("blockedbyclient").catch(() => {});
      return;
    }
    void request.continue().catch(() => {});
  });
  page.__chatGptLeanBrowsingEnabled = true;
}
