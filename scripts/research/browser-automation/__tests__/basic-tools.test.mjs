import { describe, expect, it, vi } from "vitest";
import { auditHtmlFromSignals, buildFixPlanMarkdown, issuesToCsv } from "../html-audit.mjs";
import { assembleTools, resolveToolPacks } from "../tools/index.mjs";
import { BROWSER_AUTOMATION_TOOLS, executeBrowserTool } from "../tools.mjs";

function mockPage(overrides = {}) {
  return {
    url: () => "https://example.com/",
    screenshot: vi.fn(async () => "base64-image-data"),
    evaluate: vi.fn(async (fn) => {
      const src = typeof fn === "function" ? fn.toString() : "";
      if (src.includes("documentTitle")) {
        return {
          currentUrl: "https://example.com/",
          documentTitle: "Example",
          activeElementTag: "",
          activeFieldValue: "",
        };
      }
      if (src.includes("readyState")) return "complete";
      if (src.includes("metaDescription")) {
        return {
          title: "Example",
          metaDescription: "Desc",
          canonical: "https://example.com/",
          h1: "Hello",
        };
      }
      if (src.includes("indexOf") && src.includes("needle")) {
        return { found: true, snippet: "Example body mentions Edmonton" };
      }
      if (src.includes("innerText")) return "Example body mentions Edmonton";
      return undefined;
    }),
    ...overrides,
  };
}

describe("browser automation basic tools", () => {
  it("registers expanded tool library", () => {
    const names = BROWSER_AUTOMATION_TOOLS.map((tool) => tool.function.name);
    expect(names).toContain("audit_page_html");
    expect(names).toContain("audit_site_pages");
    expect(names).toContain("save_text_deliverable");
    expect(names).toContain("extract_page_meta");
  });

  it("resolveToolPacks enables html_audit for audit instructions", () => {
    const packs = resolveToolPacks({
      instructionsText: "audit the homepage HTML and save fix plan",
      targetUrl: "https://client.com/",
    });
    expect(packs).toContain("html_audit");
    expect(packs).toContain("deliverables");
  });

  it("get_page_info returns preflight status", async () => {
    const page = mockPage();
    const result = await executeBrowserTool(page, "get_page_info", {}, {
      preflightStatus: { status: 200, ok: true, finalUrl: "https://example.com/" },
    });
    expect(result.httpStatus).toBe(200);
  });

  it("capture_screenshot appends image deliverable", async () => {
    const page = mockPage();
    const deliverables = [];
    const result = await executeBrowserTool(
      page,
      "capture_screenshot",
      { label: "Homepage capture" },
      { deliverables },
    );
    expect(result.ok).toBe(true);
    expect(deliverables[0]?.kind).toBe("image");
  });

  it("save_text_deliverable appends text deliverable", async () => {
    const page = mockPage();
    const deliverables = [];
    await executeBrowserTool(
      page,
      "save_text_deliverable",
      { content: "# Report", filename: "report.md" },
      { deliverables },
    );
    expect(deliverables[0]?.kind).toBe("text");
    expect(deliverables[0]?.content).toContain("# Report");
  });

  it("extract_page_meta reads title and h1", async () => {
    const page = mockPage();
    const result = await executeBrowserTool(page, "extract_page_meta", {}, {});
    expect(result.title).toBe("Example");
    expect(result.h1).toBe("Hello");
  });

  it("verify_page_contains finds phrase", async () => {
    const page = mockPage();
    const result = await executeBrowserTool(page, "verify_page_contains", { text: "Edmonton" }, {});
    expect(result.found).toBe(true);
  });
});

describe("html audit helpers", () => {
  it("issuesToCsv formats rows", () => {
    const csv = issuesToCsv({
      url: "https://example.com/",
      httpStatus: 500,
      issues: [
        {
          category: "http_error",
          severity: "high",
          location: "server",
          htmlSnippet: "<title>Err</title>",
          fixRecommendation: "Fix server error",
        },
      ],
    });
    expect(csv).toContain("http_error");
    expect(csv).toContain("Fix server error");
  });

  it("buildFixPlanMarkdown includes summary", () => {
    const md = buildFixPlanMarkdown({
      summary: "Broken page",
      fixPlan: "1. Fix H1",
      url: "https://example.com/",
      httpStatus: 200,
      passed: false,
    });
    expect(md).toContain("Broken page");
    expect(md).toContain("1. Fix H1");
  });

  it("auditHtmlFromSignals catches missing title", () => {
    const audit = auditHtmlFromSignals(
      { title: "", h1: "", h1Count: 0, metaDescription: "", bodyTextLength: 10 },
      200,
      true,
    );
    expect(audit.htmlOk).toBe(false);
    expect(audit.issues.length).toBeGreaterThan(0);
  });
});

describe("assembleTools", () => {
  it("limits tools to selected packs", () => {
    const tools = assembleTools(["core", "html_audit", "deliverables"]);
    const names = tools.map((tool) => tool.function.name);
    expect(names).toContain("audit_page_html");
    expect(names).not.toContain("click_at");
  });
});
