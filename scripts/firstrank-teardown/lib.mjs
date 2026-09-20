import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  isProxyConfigured,
  launchBrowserWithResidentialProxy,
  requireProxyEnv,
} from "../research/residential-proxy/lib.mjs";

export const ALLOWED_METHOD = "GET";

export const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export function proxiedGetHeaders() {
  return {
    "User-Agent": CHROME_UA,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
    "Accept-Language": "en-CA,en;q=0.9",
  };
}

export function assertGet(method) {
  if (method !== ALLOWED_METHOD) {
    throw new Error("Only GET is allowed");
  }
}

export function requireConfiguredProxy(env) {
  if (!isProxyConfigured(env)) {
    throw new Error("Residential proxy is required. Stop.");
  }
  return requireProxyEnv(env);
}

export function navigationOk(res) {
  const status = res?.status() ?? 0;
  return status === 304 || (status >= 200 && status < 300);
}

export async function openProxiedSession() {
  assertGet("GET");
  requireConfiguredProxy();
  const launched = await launchBrowserWithResidentialProxy({ headed: false });
  await launched.page.setCacheEnabled(false);
  const headers = proxiedGetHeaders();
  await launched.page.setExtraHTTPHeaders({
    Accept: headers.Accept,
    "Accept-Language": headers["Accept-Language"],
  });
  return launched;
}

export async function proxiedGetText(page, url) {
  assertGet("GET");
  const res = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
    referer: "",
  });
  if (!navigationOk(res)) {
    throw new Error(`GET failed ${res?.status() ?? 0}`);
  }
  return page.evaluate(() => document.body?.innerText ?? "");
}

export async function proxiedGetHtml(page, url) {
  assertGet("GET");
  const res = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
    referer: "",
  });
  if (!navigationOk(res)) {
    throw new Error(`GET failed ${res?.status() ?? 0}`);
  }
  return page.content();
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function writeGitignoredJson(dest, data) {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function extractJsonLd(html) {
  const blocks = [];
  const marker = 'type="application/ld+json"';
  let from = 0;
  while (from < html.length) {
    const startAttr = html.indexOf(marker, from);
    if (startAttr < 0) break;
    const tagEnd = html.indexOf(">", startAttr);
    const close = html.indexOf("</script>", tagEnd);
    if (tagEnd < 0 || close < 0) break;
    const raw = html.slice(tagEnd + 1, close).trim();
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      blocks.push({ invalid: true });
    }
    from = close + 9;
  }
  return blocks;
}

export function jsonLdTypes(blocks) {
  const types = [];
  for (const block of blocks) {
    if (!block || block.invalid) continue;
    const graph = Array.isArray(block["@graph"]) ? block["@graph"] : [block];
    for (const node of graph) {
      const t = node?.["@type"];
      if (Array.isArray(t)) types.push(...t);
      else if (typeof t === "string") types.push(t);
    }
  }
  return [...new Set(types)];
}
