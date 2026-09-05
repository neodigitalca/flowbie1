const BLOCK_URL_FRAGMENTS = ["/sorry/", "/captcha", "challenges.cloudflare.com", "sgcaptcha"];
const BLOCK_BODY_PATTERNS = [
  "unusual traffic",
  "verify you are human",
  "verify you're a human",
  "access denied",
  "cf-challenge",
  "cloudflare",
  "just a moment",
  "checking your browser",
  "enable javascript and cookies",
];

export function bodyHasBlockSignals(text) {
  const body = String(text ?? "").toLowerCase();
  if (!body) return false;
  return BLOCK_BODY_PATTERNS.some((pattern) => body.includes(pattern));
}

export function urlHasBlockSignals(url) {
  const u = String(url ?? "").toLowerCase();
  return BLOCK_URL_FRAGMENTS.some((frag) => u.includes(frag));
}

/**
 * @param {import("puppeteer").Page} page
 */
export async function detectBlocked(page) {
  const url = page.url();
  if (urlHasBlockSignals(url)) {
    return { blocked: true, reason: `blocked_url:${url.slice(0, 120)}` };
  }

  const snapshot = await page.evaluate(() => ({
    title: document.title ?? "",
    body: (document.body?.innerText ?? "").slice(0, 4000),
  }));

  if (bodyHasBlockSignals(`${snapshot.title}\n${snapshot.body}`)) {
    return { blocked: true, reason: "blocked_page_content" };
  }

  return { blocked: false, reason: "" };
}

/**
 * @param {import("puppeteer").Page} page
 */
export function attachBlockResponseListener(page) {
  /** @type {{ status?: number, url?: string } | null} */
  let lastBadResponse = null;

  const handler = (response) => {
    const status = response.status();
    if (status === 403 || status === 429) {
      lastBadResponse = { status, url: response.url() };
    }
  };

  page.on("response", handler);
  return {
    consume() {
      const hit = lastBadResponse;
      lastBadResponse = null;
      return hit;
    },
    detach() {
      page.off("response", handler);
    },
  };
}
