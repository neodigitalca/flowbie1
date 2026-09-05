import { detectBlocked } from "../block-detect.mjs";
import {
  auditHtmlWithOpenRouter,
  collectHtmlAuditSignals,
  urlSlugFromString,
} from "../html-audit.mjs";
import { probeDirectUrl } from "../preflight.mjs";
import { auditSitePages, buildSiteAuditRow, siteHealthRowsToCsv } from "../site-health-audit.mjs";
import {
  pushCsvDeliverable,
  pushImageDeliverable,
  pushTextDeliverable,
} from "./deliverable-helpers.mjs";
import { executeInteractionTool, isInteractionTool } from "./interaction.mjs";
import {
  BROWSER_VIEWPORT,
  capturePageScreenshot,
  collectPageState,
  sanitizeFilename,
  waitForUrlChange,
} from "./shared.mjs";

async function pollUntil(page, timeoutMs, check) {
  const deadline = Date.now() + Math.min(Math.max(timeoutMs, 1000), 60_000);
  while (Date.now() < deadline) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

/** @param {import("puppeteer").Page} page @param {string} name @param {Record<string, unknown>} args @param {Record<string, unknown>} context */
export async function executeBrowserTool(page, name, args, context = {}) {
  if (isInteractionTool(name)) {
    const result = await executeInteractionTool(page, name, args);
    if (result) return result;
  }

  switch (name) {
    case "navigate": {
      const url = String(args.url ?? "").trim();
      if (!url) throw new Error("navigate requires url");
      const urlBefore = page.url();
      await page.goto(url, { waitUntil: "networkidle2", timeout: 90_000 });
      return { ok: true, urlBefore, urlAfter: page.url(), navigated: page.url() !== urlBefore };
    }
    case "wait": {
      const ms = Math.min(Math.max(Number(args.ms ?? 1000), 0), 30_000);
      await new Promise((resolve) => setTimeout(resolve, ms));
      return { ok: true, ms };
    }
    case "complete":
      return {
        done: true,
        success: Boolean(args.success),
        summary: String(args.summary ?? ""),
        notes: String(args.notes ?? ""),
      };
    case "report_blocked": {
      const blockStatus = await detectBlocked(page);
      return {
        done: true,
        success: false,
        summary: String(args.reason ?? blockStatus.reason ?? "Page blocked"),
        notes: String(args.notes ?? blockStatus.reason ?? ""),
        blocked: true,
      };
    }
    case "reload_page":
      await page.reload({ waitUntil: "networkidle2", timeout: 90_000 });
      return { ok: true, url: page.url() };
    case "go_back":
      await page.goBack({ waitUntil: "networkidle2", timeout: 30_000 }).catch(() => {});
      return { ok: true, url: page.url() };
    case "wait_for_text": {
      const text = String(args.text ?? "").trim();
      const timeoutMs = Number(args.timeoutMs ?? 15_000);
      const found = await pollUntil(page, timeoutMs, () =>
        page.evaluate((needle) => (document.body?.innerText ?? "").includes(needle), text),
      );
      return { ok: found, text, timeoutMs };
    }
    case "wait_for_url": {
      const contains = String(args.contains ?? "").trim();
      const timeoutMs = Number(args.timeoutMs ?? 15_000);
      const found = await pollUntil(page, timeoutMs, async () => page.url().includes(contains));
      return { ok: found, contains, url: page.url(), timeoutMs };
    }
    case "scroll_to_top":
      await page.evaluate(() => window.scrollTo(0, 0));
      return { ok: true };
    case "scroll_to_bottom":
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      return { ok: true };
    case "get_page_info": {
      const pageState = await collectPageState(page);
      const readyState = await page.evaluate(() => document.readyState);
      const preflight = context.preflightStatus ?? null;
      return {
        ok: true,
        url: page.url(),
        title: pageState.documentTitle,
        httpStatus: preflight?.status ?? null,
        httpOk: preflight?.ok ?? null,
        preflightFinalUrl: preflight?.finalUrl ?? null,
        readyState,
      };
    }
    case "extract_page_meta": {
      const meta = await page.evaluate(() => {
        const content = (sel) => document.querySelector(sel)?.getAttribute("content") ?? "";
        const h1 = document.querySelector("h1")?.textContent?.trim() ?? "";
        return {
          title: document.title ?? "",
          metaDescription: content('meta[name="description"]') || content('meta[property="og:description"]'),
          canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
          h1,
        };
      });
      return { ok: true, ...meta, url: page.url() };
    }
    case "extract_visible_text": {
      const maxChars = Math.min(Math.max(Number(args.maxChars ?? 8000), 500), 20_000);
      const text = await page.evaluate((limit) => {
        const main =
          document.querySelector("main") ??
          document.querySelector("[role='main']") ??
          document.body;
        return (main?.innerText ?? "").trim().slice(0, limit);
      }, maxChars);
      return { ok: true, text, length: text.length, url: page.url() };
    }
    case "list_page_links": {
      const limit = Math.min(Math.max(Number(args.limit ?? 50), 1), 100);
      const origin = new URL(page.url()).origin;
      const links = await page.evaluate(
        (max, siteOrigin) =>
          [...document.querySelectorAll("a[href]")]
            .map((a) => ({
              text: (a.textContent ?? "").trim().slice(0, 120),
              href: a.href,
              isInternal: a.href.startsWith(siteOrigin),
            }))
            .filter((row) => row.href)
            .slice(0, max),
        limit,
        origin,
      );
      return { ok: true, links, count: links.length };
    }
    case "verify_page_contains": {
      const text = String(args.text ?? "").trim();
      const result = await page.evaluate((needle) => {
        const body = document.body?.innerText ?? "";
        const index = body.toLowerCase().indexOf(needle.toLowerCase());
        if (index < 0) return { found: false, snippet: "" };
        const start = Math.max(0, index - 40);
        return { found: true, snippet: body.slice(start, index + needle.length + 40).trim() };
      }, text);
      return { ok: true, query: text, ...result };
    }
    case "extract_competitor_headings": {
      const headings = await page.evaluate(() => {
        const pick = (tag) =>
          [...document.querySelectorAll(tag)]
            .map((el) => (el.textContent ?? "").trim())
            .filter(Boolean)
            .slice(0, 30);
        return { h1: pick("h1"), h2: pick("h2"), h3: pick("h3") };
      });
      return { ok: true, ...headings, url: page.url() };
    }
    case "capture_screenshot": {
      const label = String(args.label ?? "").trim() || "Screenshot";
      const fullPage = Boolean(args.fullPage);
      const base64 = await capturePageScreenshot(page, { fullPage });
      const saved = pushImageDeliverable(context, {
        label,
        filename: args.filename,
        base64,
        fullPage,
        url: page.url(),
      });
      return { ok: true, ...saved, fullPage };
    }
    case "save_text_deliverable": {
      const content = String(args.content ?? "");
      if (!content.trim()) throw new Error("save_text_deliverable requires content");
      const saved = pushTextDeliverable(context, {
        label: args.label,
        filename: args.filename,
        content,
        mime: args.mime,
        url: page.url(),
      });
      return { ok: true, ...saved };
    }
    case "save_csv_deliverable": {
      const content = String(args.content ?? "");
      if (!content.trim()) throw new Error("save_csv_deliverable requires content");
      const saved = pushCsvDeliverable(context, {
        label: args.label,
        filename: args.filename,
        content,
        url: page.url(),
      });
      return { ok: true, ...saved };
    }
    case "search_serp": {
      const query = String(args.query ?? "").trim();
      if (!query) throw new Error("search_serp requires query");
      if (!context.fetchSerp) throw new Error("search_serp is not available in this session");
      const serp = await context.fetchSerp({
        query,
        location: String(args.location ?? "").trim() || undefined,
      });
      return { ok: true, serp };
    }
    case "fetch_url_status": {
      const urls = Array.isArray(args.urls) ? args.urls.map((u) => String(u).trim()).filter(Boolean) : [];
      if (!urls.length) throw new Error("fetch_url_status requires urls");
      const results = [];
      for (const url of urls.slice(0, 20)) {
        const probe = await probeDirectUrl(url);
        results.push({
          url,
          status: probe.status,
          ok: probe.ok,
          finalUrl: probe.finalUrl ?? url,
          reason: probe.reason,
        });
      }
      return { ok: true, results };
    }
    case "open_serp_result": {
      const index = Math.max(1, Math.round(Number(args.index ?? 1)));
      const organic = context.serpContext?.organic;
      if (!Array.isArray(organic) || !organic.length) {
        throw new Error("open_serp_result requires prior search_serp results");
      }
      const row = organic[index - 1];
      const url = String(row?.url ?? "").trim();
      if (!url) throw new Error(`SERP result #${index} has no URL`);
      const urlBefore = page.url();
      await page.goto(url, { waitUntil: "networkidle2", timeout: 90_000 });
      return { ok: true, index, title: row.title, urlBefore, urlAfter: page.url() };
    }
    case "audit_page_html": {
      const url = page.url();
      const preflight = context.preflightStatus ?? null;
      const probe = await probeDirectUrl(url);
      const httpStatus = Number(preflight?.status ?? probe.status ?? 0);
      const httpOk = Boolean(preflight?.ok ?? probe.ok);
      const { html, signals } = await collectHtmlAuditSignals(page);
      const audit = await auditHtmlWithOpenRouter({
        html,
        signals,
        url,
        httpStatus,
        httpOk,
        env: context.env ?? {},
      });
      const passed = httpOk && httpStatus >= 200 && httpStatus < 300 && audit.htmlOk;
      const slug = urlSlugFromString(url);
      const checkedAt = new Date().toISOString();
      const csv = siteHealthRowsToCsv([
        buildSiteAuditRow({
          url,
          probe: { ...probe, responseTimeMs: 0 },
          meta: signals,
          checkedAt,
        }),
      ]);
      pushCsvDeliverable(context, {
        label: "Site audit report",
        filename: `site-audit-${slug}.csv`,
        content: csv,
        url,
      });
      return {
        ok: passed,
        passed,
        httpStatus,
        httpOk,
        htmlOk: audit.htmlOk,
        issueCount: audit.issues.length,
        summary: audit.summary,
        fixPlan: audit.fixPlan,
      };
    }
    case "audit_site_pages": {
      const auditAll = Boolean(args.auditAll) || args.maxPages === null;
      const maxPages = auditAll ? null : Math.min(Math.max(Number(args.maxPages ?? 15), 1), 500);
      const audit = await auditSitePages(
        page,
        {
          maxPages,
          auditAll,
          startUrl: args.startUrl ? String(args.startUrl) : undefined,
        },
        {
          onProgress: context.onAuditProgress,
          onRow: context.onAuditRow,
        },
      );
      return {
        ok: true,
        pagesChecked: audit.pagesChecked,
        passedCount: audit.passedCount,
        failedCount: audit.failedCount,
        summary: audit.summary,
        csvFilename: audit.filename,
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export { BROWSER_VIEWPORT, capturePageScreenshot, collectPageState };
