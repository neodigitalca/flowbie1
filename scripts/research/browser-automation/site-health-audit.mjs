import { probeDirectUrl } from "./preflight.mjs";
import { urlSlugFromString } from "./html-audit.mjs";

const PAGE_GOTO_TIMEOUT_MS = 25_000;
const SETTLE_MS = 400;
const MAX_AUDIT_PAGES_CAP = 2000;
const DEFAULT_AUDIT_PAGES = 15;

/** @param {import("puppeteer").Page} page */
export async function dismissPageOverlays(page) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.evaluate(() => {
    for (const selector of [
      "[role='dialog']",
      ".search-overlay",
      ".modal",
      ".popup",
      ".overlay.active",
    ]) {
      for (const el of document.querySelectorAll(selector)) {
        el.remove();
      }
    }
    document.body.style.overflow = "";
  }).catch(() => {});
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** @param {string} href @param {string} origin */
export function normalizeInternalUrl(href, origin) {
  try {
    const u = new URL(href, origin);
    if (u.origin !== origin) return null;
    if (!/^https?:$/i.test(u.protocol)) return null;
    if (/\/wp-admin|\/wp-login|\/feed\/|\/xmlrpc\.php|\/wp-json\//i.test(u.pathname)) return null;
    if (/\.(pdf|jpg|jpeg|png|gif|webp|zip|doc|docx|xls|xlsx)$/i.test(u.pathname)) return null;
    u.hash = "";
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.origin}${path}${u.search}`;
  } catch {
    return null;
  }
}

/** @param {string} xml */
export function parseSitemapLocUrls(xml) {
  const urls = [];
  const locPattern = /<loc>\s*([^<\s][^<]*?)\s*<\/loc>/gi;
  let match = locPattern.exec(xml);
  while (match) {
    urls.push(match[1].trim());
    match = locPattern.exec(xml);
  }
  return urls;
}

/** @param {string} sitemapUrl */
function sitemapChildPriority(sitemapUrl) {
  if (/page-sitemap/i.test(sitemapUrl)) return 0;
  if (/location-sitemap|service-area|our-team/i.test(sitemapUrl)) return 1;
  if (/category-sitemap|video-sitemap/i.test(sitemapUrl)) return 2;
  if (/post-sitemap/i.test(sitemapUrl)) return 4;
  return 3;
}

/** @param {string} origin @param {number} limit */
export async function fetchSitemapUrls(origin, limit = 60) {
  const candidates = [`${origin}/wp-sitemap.xml`, `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  const collected = [];

  for (const sitemapUrl of candidates) {
    if (collected.length >= limit) break;
    try {
      const res = await fetch(sitemapUrl, {
        headers: { Accept: "application/xml,text/xml" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const locs = parseSitemapLocUrls(xml);
      const childSitemaps = locs
        .filter((loc) => /sitemap.*\.xml$/i.test(loc) && loc !== sitemapUrl)
        .sort((a, b) => sitemapChildPriority(a) - sitemapChildPriority(b));
      const pageUrls = locs.filter((loc) => !/sitemap.*\.xml$/i.test(loc));

      for (const loc of pageUrls) {
        if (collected.length >= limit) break;
        collected.push(loc);
      }

      for (const childUrl of childSitemaps) {
        if (collected.length >= limit) break;
        try {
          const childRes = await fetch(childUrl, { signal: AbortSignal.timeout(12_000) });
          if (!childRes.ok) continue;
          for (const childLoc of parseSitemapLocUrls(await childRes.text())) {
            if (collected.length >= limit) break;
            if (!/sitemap.*\.xml$/i.test(childLoc)) collected.push(childLoc);
          }
        } catch {
          // skip broken child sitemap
        }
      }

      if (collected.length > 0) break;
    } catch {
      // try next candidate
    }
  }

  return collected.slice(0, limit);
}

/** @param {import("puppeteer").Page} page @param {number} maxDiscover */
export async function discoverInternalUrls(page, maxDiscover = 80) {
  const origin = new URL(page.url()).origin;
  const rawLinks = await page.evaluate((max) => {
    return [...document.querySelectorAll("a[href]")]
      .map((a) => ({
        text: (a.textContent ?? "").trim().slice(0, 120),
        href: a.href,
      }))
      .filter((row) => row.href)
      .slice(0, max);
  }, maxDiscover);

  const seen = new Set();
  const urls = [];
  for (const link of rawLinks) {
    const normalized = normalizeInternalUrl(link.href, origin);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      urls.push({ url: normalized, text: link.text });
    }
  }
  return urls;
}

/** @param {string} url */
export async function probeUrlWithTiming(url) {
  const start = Date.now();
  const probe = await probeDirectUrl(url);
  return { ...probe, responseTimeMs: Date.now() - start };
}

/** @param {import("puppeteer").Page} page @param {string} url */
export async function gotoForAudit(page, url) {
  const start = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_GOTO_TIMEOUT_MS });
  await page.waitForFunction(() => document.readyState === "complete", { timeout: 5000 }).catch(() => {});
  await dismissPageOverlays(page);
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
  return Date.now() - start;
}

/** @param {Record<string, unknown>} meta @param {{ ok?: boolean, status?: number, responseTimeMs?: number, navigationMs?: number }} probe */
export function evaluatePageHealth(meta, probe) {
  const issues = [];
  const httpStatus = Number(probe.status ?? 0);
  if (!probe.ok || httpStatus < 200 || httpStatus >= 400) {
    issues.push(`HTTP ${httpStatus || "error"}`);
  }
  if (probe.navigationError) issues.push(String(probe.navigationError));
  if (!String(meta.title ?? "").trim()) issues.push("missing title");
  if (!String(meta.h1 ?? "").trim()) issues.push("missing h1");
  if (Number(meta.h1Count ?? 0) > 1) issues.push("multiple h1");
  if (!String(meta.metaDescription ?? "").trim()) issues.push("missing meta description");
  if (Number(meta.bodyTextLength ?? 0) < 80) issues.push("thin body content");
  const responseMs = Math.max(Number(probe.responseTimeMs ?? 0), Number(probe.navigationMs ?? 0));
  if (responseMs > 8000) issues.push("slow response (>8s)");
  return {
    passed: issues.length === 0,
    issues: issues.join("; "),
  };
}

/** @param {import("puppeteer").Page} page */
export async function collectPageHealthMeta(page) {
  return page.evaluate(() => {
    const content = (sel) => document.querySelector(sel)?.getAttribute("content") ?? "";
    const h1s = [...document.querySelectorAll("h1")]
      .map((el) => (el.textContent ?? "").trim())
      .filter(Boolean);
    const bodyText = (document.body?.innerText ?? "").trim();
    return {
      title: document.title ?? "",
      h1: h1s[0] ?? "",
      h1Count: h1s.length,
      metaDescription: content('meta[name="description"]') || content('meta[property="og:description"]'),
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
      bodyTextLength: bodyText.length,
      readyState: document.readyState,
    };
  });
}

/** @param {string} url */
export function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

/**
 * @param {{ url: string, probe: Record<string, unknown>, meta: Record<string, unknown>, checkedAt: string, navigationMs?: number, navigationError?: string }} input
 */
export function buildSiteAuditRow(input) {
  const responseTimeMs = Math.max(
    Number(input.probe.responseTimeMs ?? 0),
    Number(input.navigationMs ?? 0),
  );
  return {
    url: input.url,
    statusCode: Number(input.probe.status ?? 0),
    responseTimeMs,
    contentType: String(input.probe.contentType ?? ""),
    metaDescription: String(input.meta.metaDescription ?? ""),
    h1: String(input.meta.h1 ?? ""),
    domain: domainFromUrl(input.url),
    checkedAt: input.checkedAt,
    _passed: evaluatePageHealth(input.meta, {
      ...input.probe,
      responseTimeMs,
      navigationError: input.navigationError,
    }).passed,
  };
}

/** Periodic site audit CSV: one row per page, spreadsheet-friendly columns. */
export function siteHealthRowsToCsv(rows) {
  const header = [
    "url",
    "status_code",
    "response_time_ms",
    "content_type",
    "meta_description",
    "h1",
    "domain",
    "checked_at",
  ].join(",");
  const body = rows.map((row) =>
    [
      row.url,
      row.statusCode,
      row.responseTimeMs,
      row.contentType,
      row.metaDescription,
      row.h1,
      row.domain,
      row.checkedAt,
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header, ...body].join("\n");
}

/** @param {string} origin @param {string} startUrl @param {number} maxPages @param {import("puppeteer").Page} page */
export async function buildAuditUrlQueue(origin, startUrl, maxPages, page) {
  const seen = new Set();
  const queue = [];

  function enqueue(url) {
    const normalized = normalizeInternalUrl(url, origin);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    queue.push(normalized);
  }

  enqueue(startUrl);
  for (const url of await fetchSitemapUrls(origin, maxPages * 3)) {
    enqueue(url);
  }
  for (const row of await discoverInternalUrls(page, 120)) {
    enqueue(row.url);
  }

  return { queue, seen };
}

/**
 * @param {import("puppeteer").Page} page
 * @param {{ maxPages?: number | null, auditAll?: boolean, startUrl?: string }} args
 * @param {{ onProgress?: (payload: { index: number, total: number, url: string }) => void, onRow?: (payload: { csv: string, filename: string, label: string, url: string, index: number, total: number }) => void }} [options]
 */
export async function auditSitePages(page, args = {}, options = {}) {
  const auditAll = Boolean(args.auditAll) || args.maxPages === null;
  const maxPages = auditAll
    ? MAX_AUDIT_PAGES_CAP
    : Math.min(Math.max(Number(args.maxPages ?? DEFAULT_AUDIT_PAGES), 1), MAX_AUDIT_PAGES_CAP);
  const startUrl = String(args.startUrl ?? page.url()).trim() || page.url();
  const origin = new URL(startUrl).origin;
  const onProgress = options.onProgress;

  if (normalizeInternalUrl(page.url(), origin) !== normalizeInternalUrl(startUrl, origin)) {
    await gotoForAudit(page, startUrl);
  } else {
    await dismissPageOverlays(page);
  }

  const sitemapLimit = auditAll ? MAX_AUDIT_PAGES_CAP : maxPages * 3;
  const { queue: initialQueue, seen } = await buildAuditUrlQueue(origin, startUrl, sitemapLimit, page);
  const pending = [...initialQueue];
  const slug = urlSlugFromString(startUrl);
  const filename = `site-audit-${slug}.csv`;
  const checkedAt = new Date().toISOString();
  const rows = [];
  const progressTotal = auditAll ? Math.max(pending.length, 1) : maxPages;

  while (rows.length < maxPages && pending.length > 0) {
    const url = pending.shift();
    if (!url) break;

    onProgress?.({ index: rows.length + 1, total: progressTotal, url });

    const probe = await probeUrlWithTiming(url);
    let navigationMs = 0;
    let navigationError = "";

    try {
      if (normalizeInternalUrl(page.url(), origin) !== url) {
        navigationMs = await gotoForAudit(page, url);
      }
    } catch (error) {
      navigationError =
        error instanceof Error ? error.message.slice(0, 120) : "navigation_failed";
    }

    let meta = {
      title: "",
      h1: "",
      h1Count: 0,
      metaDescription: "",
      canonical: "",
      bodyTextLength: 0,
      readyState: "",
    };
    if (!navigationError) {
      try {
        meta = await collectPageHealthMeta(page);
      } catch {
        navigationError = "meta_collection_failed";
      }
    }

    const responseTimeMs = Math.max(probe.responseTimeMs ?? 0, navigationMs);
    rows.push(
      buildSiteAuditRow({
        url,
        probe,
        meta,
        checkedAt,
        navigationMs,
        navigationError,
      }),
    );

    options.onRow?.({
      csv: siteHealthRowsToCsv(rows),
      filename,
      label: `Site audit report (${rows.length}/${progressTotal})`,
      url,
      index: rows.length,
      total: progressTotal,
    });

    if (!navigationError && rows.length < maxPages) {
      for (const row of await discoverInternalUrls(page, 60)) {
        if (pending.length + rows.length >= maxPages * 4) break;
        const normalized = normalizeInternalUrl(row.url, origin);
        if (normalized && !seen.has(normalized)) {
          seen.add(normalized);
          pending.push(normalized);
        }
      }
    }
  }

  const passedCount = rows.filter((row) => row._passed).length;
  const failedCount = rows.length - passedCount;
  const csv = siteHealthRowsToCsv(rows);
  const summary = auditAll
    ? `Checked all ${rows.length} discoverable page(s) on ${origin}. ${passedCount} passed, ${failedCount} failed. CSV saved.`
    : `Checked ${rows.length} page(s) on ${origin}. ${passedCount} passed, ${failedCount} failed. CSV saved for periodic review.`;

  return {
    ok: true,
    pagesChecked: rows.length,
    passedCount,
    failedCount,
    rows,
    csv,
    slug,
    summary,
    filename,
  };
}
