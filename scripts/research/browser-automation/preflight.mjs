import { bodyHasBlockSignals, urlHasBlockSignals } from "./block-detect.mjs";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * @param {string} targetUrl
 */
export async function probeDirectUrl(targetUrl) {
  const url = String(targetUrl ?? "").trim();
  if (!url) {
    return { ok: false, status: 0, reason: "missing_url", useProxy: true };
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(20_000),
    });

    const status = res.status;
    const finalUrl = res.url || url;
    const contentType = res.headers.get("content-type") ?? "";
    const text = (await res.text()).slice(0, 8000);

    if (urlHasBlockSignals(finalUrl) || bodyHasBlockSignals(text)) {
      return {
        ok: false,
        status,
        contentType,
        reason: "block_signals_in_preflight",
        useProxy: true,
        finalUrl,
      };
    }

    if (status >= 200 && status < 400) {
      return { ok: true, status, contentType, reason: "direct_ok", useProxy: false, finalUrl };
    }

    return {
      ok: false,
      status,
      contentType,
      reason: `http_${status}`,
      useProxy: true,
      finalUrl,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      contentType: "",
      reason: error instanceof Error ? error.message : "preflight_failed",
      useProxy: true,
    };
  }
}
