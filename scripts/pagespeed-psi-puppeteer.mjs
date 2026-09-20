/**
 * Official PSI mobile scores + Puppeteer CLS/LCP via Oxylabs residential proxy.
 *
 * Usage: node scripts/pagespeed-psi-puppeteer.mjs
 *        node scripts/pagespeed-psi-puppeteer.mjs --url=https://neodigital.ca/
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isProxyConfigured,
  launchBrowserWithResidentialProxy,
  resolveResidentialProxyEnv,
} from "./research/residential-proxy/lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const outDir = path.join(repoRoot, "tmp", "pagespeed");

const HOME = "https://neodigital.ca/";
const INNER_DEFAULT = "https://neodigital.ca/about/";
const PSI_CATEGORIES = ["PERFORMANCE", "ACCESSIBILITY", "BEST_PRACTICES", "SEO"];
const AUDIT_IDS = [
  "largest-contentful-paint",
  "cumulative-layout-shift",
  "total-blocking-time",
  "unused-javascript",
  "render-blocking-resources",
  "uses-rel-preload",
  "unsized-images",
  "font-display",
  "uses-optimized-images",
  "modern-image-formats",
];

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function score100(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.round(value * 100);
}

async function fetchPsi(url, attempt = 1) {
  const params = new URLSearchParams({ url, strategy: "mobile" });
  for (const cat of PSI_CATEGORIES) params.append("category", cat);
  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 180_000);
  try {
    const res = await fetch(endpoint, { signal: ac.signal });
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 20_000 * attempt));
      return fetchPsi(url, attempt + 1);
    }
    if (!res.ok) {
      throw new Error(`PSI HTTP ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } catch (error) {
    if (attempt < 4 && !(error instanceof Error && error.message.startsWith("PSI HTTP 4") && !error.message.includes("429"))) {
      await new Promise((r) => setTimeout(r, 20_000 * attempt));
      return fetchPsi(url, attempt + 1);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function summarizePsi(json) {
  const cats = json?.lighthouseResult?.categories ?? {};
  const audits = json?.lighthouseResult?.audits ?? {};
  const metrics = {};
  for (const id of AUDIT_IDS) {
    const a = audits[id];
    if (!a) continue;
    metrics[id] = {
      title: a.title ?? id,
      score: a.score,
      displayValue: a.displayValue ?? "",
      numericValue: a.numericValue,
    };
  }
  const failedAudits = Object.entries(audits)
    .filter(([, a]) => typeof a.score === "number" && a.score < 1 && a.scoreDisplayMode !== "informative")
    .map(([id, a]) => ({
      id,
      title: a.title ?? id,
      score: a.score,
      displayValue: a.displayValue ?? "",
    }))
    .slice(0, 40);
  return {
    fetchTime: json?.analysisUTCTimestamp ?? json?.lighthouseResult?.fetchTime ?? "",
    scores: {
      performance: score100(cats.performance?.score),
      accessibility: score100(cats.accessibility?.score),
      bestPractices: score100(cats["best-practices"]?.score),
      seo: score100(cats.seo?.score),
    },
    metrics,
    failedAudits,
  };
}

async function puppeteerTrace(url, useProxy) {
  if (useProxy && !isProxyConfigured()) {
    return { ok: false, error: "Residential proxy is not configured." };
  }
  if (!useProxy) {
    return { ok: false, error: "Puppeteer path requires Oxylabs. PSI still ran." };
  }
  const launched = await launchBrowserWithResidentialProxy({
    headed: false,
    env: resolveResidentialProxyEnv(),
  });
  const { browser, page } = launched;
  try {
    await page.setViewport({ width: 412, height: 823, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const client = await page.createCDPSession();
    await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.evaluateOnNewDocument(() => {
      window.__npPsi = { shifts: [], lcp: null };
      const shiftObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            const node = entry.sources?.[0]?.node;
            window.__npPsi.shifts.push({
              value: entry.value,
              selector: node ? `${node.tagName || ""}.${node.className || ""}`.trim() : "",
            });
          }
        }
      });
      shiftObs.observe({ type: "layout-shift", buffered: true });
      const lcpObs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (!last) return;
        const el = last.element;
        window.__npPsi.lcp = {
          renderTime: last.startTime,
          size: last.size,
          url: last.url || "",
          tag: el ? el.tagName : "",
          id: el ? el.id : "",
          className: el ? String(el.className || "") : "",
        };
      });
      lcpObs.observe({ type: "largest-contentful-paint", buffered: true });
    });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 90_000 });
    await new Promise((r) => setTimeout(r, 3_000));
    const vitals = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const resources = performance.getEntriesByType("resource").map((r) => ({
        name: r.name,
        transferSize: r.transferSize || 0,
        initiatorType: r.initiatorType,
      }));
      const cls = (window.__npPsi?.shifts || []).reduce((sum, s) => sum + (s.value || 0), 0);
      return {
        lcp: window.__npPsi?.lcp || null,
        cls,
        shifts: window.__npPsi?.shifts || [],
        transferBytes: resources.reduce((sum, r) => sum + r.transferSize, 0),
        resources: resources
          .filter((r) => /neo-pulse|elementor|nitropack|fonts\.(google|gstatic)/i.test(r.name))
          .sort((a, b) => b.transferSize - a.transferSize)
          .slice(0, 40),
        readyState: document.readyState,
        title: document.title,
        navigationMs: nav ? nav.duration : 0,
      };
    });
    return { ok: true, ...vitals };
  } finally {
    await browser.close().catch(() => {});
  }
}

function printSummary(label, psi, trace) {
  const s = psi.scores;
  console.log(`\n=== ${label} ===`);
  console.log(
    `PSI  P:${s.performance}  A:${s.accessibility}  BP:${s.bestPractices}  SEO:${s.seo}  (${psi.fetchTime})`
  );
  for (const [id, m] of Object.entries(psi.metrics)) {
    console.log(`  ${id}: ${m.displayValue || m.numericValue || m.score}`);
  }
  if (psi.failedAudits.length) {
    console.log("Failed audits:");
    for (const a of psi.failedAudits) {
      console.log(`  - ${a.id} (${a.score}) ${a.displayValue}`);
    }
  }
  if (trace?.ok) {
    console.log(`Puppeteer CLS=${trace.cls} LCP=${JSON.stringify(trace.lcp)}`);
    if (trace.shifts?.length) {
      console.log("Shifts:");
      for (const sh of trace.shifts) console.log(`  - ${sh.value} ${sh.selector}`);
    }
  } else if (trace?.error) {
    console.log(`Puppeteer: ${trace.error}`);
  }
}

function passed(psi, trace) {
  const s = psi.scores;
  const scoresOk =
    s.performance === 100 && s.accessibility === 100 && s.bestPractices === 100 && s.seo === 100;
  const psiCls = psi.metrics["cumulative-layout-shift"]?.numericValue ?? 1;
  const puppeteerCls = trace?.ok ? trace.cls : 0;
  return scoresOk && psiCls === 0 && puppeteerCls === 0;
}

async function runUrl(url, slug) {
  fs.mkdirSync(outDir, { recursive: true });
  const useProxy = isProxyConfigured();
  let trace;
  try {
    trace = await puppeteerTrace(url, useProxy);
  } catch (error) {
    trace = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  let psiJson = null;
  let psiError = "";
  try {
    psiJson = await fetchPsi(url);
    fs.writeFileSync(path.join(outDir, `${slug}-psi.json`), JSON.stringify(psiJson, null, 2));
  } catch (error) {
    psiError = error instanceof Error ? error.message : String(error);
    console.log(`PSI failed for ${url}: ${psiError}`);
  }
  const psi = psiJson
    ? summarizePsi(psiJson)
    : { fetchTime: "", scores: { performance: null, accessibility: null, bestPractices: null, seo: null }, metrics: {}, failedAudits: [] };
  fs.writeFileSync(path.join(outDir, `${slug}-summary.json`), JSON.stringify({ url, psi, psiError, trace }, null, 2));
  printSummary(url, psi, trace);
  const ok = psiJson ? passed(psi, trace) : false;
  return { psi, trace, ok };
}

const home = argValue("url", HOME);
const inner = argValue("inner", INNER_DEFAULT);
const homeResult = await runUrl(home, "home");
const innerResult = await runUrl(inner, "inner");
const ok = homeResult.ok && innerResult.ok;
console.log(ok ? "\nPASS: PSI 100/100/100/100 and CLS 0" : "\nFAIL: scores or CLS below contract");
process.exit(ok ? 0 : 1);
