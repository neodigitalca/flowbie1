import { describe, expect, it } from "vitest";
import {
  extractMaxPagesFromInstructions,
  isClientSiteTarget,
  resolveExecutionMode,
  taskIsProgrammaticSiteAudit,
} from "../execution-mode.mjs";
import {
  evaluatePageHealth,
  normalizeInternalUrl,
  parseSitemapLocUrls,
  siteHealthRowsToCsv,
} from "../site-health-audit.mjs";
import { assembleTools, resolveToolPacks } from "../tools/index.mjs";

describe("execution mode hybrid routing", () => {
  it("uses programmatic_first for multi-page client site audit", () => {
    const mode = resolveExecutionMode({
      targetUrl: "https://kwbllp.com/",
      browsePolicy: { route: "browser_direct", hostCategory: "client_web" },
      instructionsText: "Explore 15 pages, check HTML and response time, save CSV report.",
    });
    expect(mode.mode).toBe("programmatic_first");
    expect(mode.bootstrapTool).toBe("audit_site_pages");
    expect(mode.includeVisionTools).toBe(false);
  });

  it("uses hybrid when client site needs form interaction", () => {
    const mode = resolveExecutionMode({
      targetUrl: "https://kwbllp.com/",
      browsePolicy: { route: "browser_direct", hostCategory: "client_web" },
      instructionsText: "Login to the client portal and download the report.",
    });
    expect(mode.mode).toBe("hybrid");
    expect(mode.includeVisionTools).toBe(true);
  });

  it("uses programmatic_first for every page instructions", () => {
    const mode = resolveExecutionMode({
      targetUrl: "https://kwbllp.com/",
      browsePolicy: { route: "browser_direct", hostCategory: "client_web" },
      instructionsText: "Go to every page on the site and save a CSV report.",
    });
    expect(mode.mode).toBe("programmatic_first");
    expect(mode.bootstrapTool).toBe("audit_site_pages");
  });

  it("extractMaxPagesFromInstructions returns null for every page", () => {
    expect(extractMaxPagesFromInstructions("go to every page and save csv")).toBeNull();
    expect(extractMaxPagesFromInstructions("check 15 pages")).toBe(15);
  });

  it("detects programmatic site audit tasks", () => {
    expect(
      taskIsProgrammaticSiteAudit("Explore 15 pages, check HTML and response time, save CSV"),
    ).toBe(true);
  });

  it("recognizes client sites on direct browse", () => {
    expect(isClientSiteTarget("https://kwbllp.com/", { route: "browser_direct" })).toBe(true);
    expect(isClientSiteTarget("https://chatgpt.com/", { route: "browser_proxy" })).toBe(false);
  });
});

describe("site health audit helpers", () => {
  it("normalizes internal urls and skips admin paths", () => {
    const origin = "https://example.com";
    expect(normalizeInternalUrl("https://example.com/about/", origin)).toBe("https://example.com/about");
    expect(normalizeInternalUrl("https://example.com/wp-admin/", origin)).toBeNull();
  });

  it("flags missing meta and slow responses", () => {
    const health = evaluatePageHealth(
      { title: "", h1: "", h1Count: 0, metaDescription: "", bodyTextLength: 10 },
      { ok: true, status: 200, responseTimeMs: 9000 },
    );
    expect(health.passed).toBe(false);
    expect(health.issues).toContain("missing title");
    expect(health.issues).toContain("slow response (>8s)");
  });

  it("parses sitemap loc urls", () => {
    const urls = parseSitemapLocUrls(
      '<?xml version="1.0"?><urlset><url><loc>https://example.com/about/</loc></url></urlset>',
    );
    expect(urls).toEqual(["https://example.com/about/"]);
  });

  it("builds csv rows for periodic review", () => {
    const csv = siteHealthRowsToCsv([
      {
        url: "https://example.com/",
        statusCode: 200,
        responseTimeMs: 420,
        contentType: "text/html; charset=UTF-8",
        metaDescription: "Desc",
        h1: "Welcome",
        domain: "example.com",
        checkedAt: "2026-08-20T00:00:00.000Z",
      },
    ]);
    expect(csv).toContain("status_code");
    expect(csv).toContain("content_type");
    expect(csv).toContain("Welcome");
    expect(csv).toContain("example.com");
  });
});

describe("tool packs without vision on client audit", () => {
  it("includes site_audit but not interaction for multi-page client task", () => {
    const packs = resolveToolPacks({
      targetUrl: "https://kwbllp.com/",
      instructionsText: "Explore 15 pages, check HTML and response time, save CSV.",
      executionMode: { includeVisionTools: false },
    });
    expect(packs).toContain("site_audit");
    expect(packs).not.toContain("interaction");
    const tools = assembleTools(packs);
    const names = tools.map((tool) => tool.function.name);
    expect(names).toContain("audit_site_pages");
    expect(names).not.toContain("click_at");
  });
});
