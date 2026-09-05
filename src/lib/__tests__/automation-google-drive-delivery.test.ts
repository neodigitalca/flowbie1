import { describe, expect, it, vi } from "vitest";
import {
  resolveDriveUploadDeliverables,
  resolvePrimaryDeliverable,
} from "@/lib/automation-google-drive-delivery";
import { buildAutomationEmailIntro } from "@/lib/automation-email-intro";
import { resolveOpenRouterApiKeyForHarness } from "@/lib/openrouter-api-key-resolve";

vi.mock("@/lib/automation-email-intro", () => ({
  buildAutomationEmailIntro: vi.fn(async () => ({
    highlights: ["Clicks rose"],
    talkingPoints: ["Talk clicks"],
    clientQuestions: [{ question: "Why?", answer: "Seasonality" }],
  })),
}));

vi.mock("@/lib/openrouter-api-key-resolve", () => ({
  resolveOpenRouterApiKeyForHarness: vi.fn(async () => "test-openrouter-key"),
}));

const REPORT_MD = "# Neo Digital SEO Report - August 2026\n\nClicks rose.";
const NOTES_MD = "# Client meeting notes\n\nExisting notes.";

describe("resolveDriveUploadDeliverables", () => {
  it("uploads meeting notes and the GSC report, not CSVs", async () => {
    const out = await resolveDriveUploadDeliverables({
      executionKind: "gsc_reporting",
      siteName: "Acme",
      summaryText: "",
      archiveFiles: [
        { fileName: "mom-queries.csv", content: "query,clicks", mime: "text/csv" },
        {
          fileName: "gsc-meeting-notes-yoy-acme-1.md",
          content: NOTES_MD,
          mime: "text/markdown",
        },
        { fileName: "gsc-report-yoy-acme-1.md", content: REPORT_MD, mime: "text/markdown" },
      ],
    });

    expect(out).toHaveLength(2);
    expect(out[0]?.fileName).toBe("Acme - Meeting notes - August 2026");
    expect(out[0]?.content).toBe(NOTES_MD);
    expect(out[1]?.fileName).toBe("gsc-report-yoy-acme-1");
    expect(out[1]?.content).toBe(REPORT_MD);
    expect(out.some((file) => file.content.includes("query,clicks"))).toBe(false);
  });

  it("builds meeting notes when the archive only has the report", async () => {
    const out = await resolveDriveUploadDeliverables({
      executionKind: "gsc_reporting",
      siteName: "Acme",
      summaryText: "",
      archiveFiles: [{ fileName: "gsc-report-mom-acme-1.md", content: REPORT_MD, mime: "text/markdown" }],
    });

    expect(buildAutomationEmailIntro).toHaveBeenCalled();
    expect(out).toHaveLength(2);
    expect(out[0]?.fileName).toBe("Acme - Meeting notes - August 2026");
    expect(out[0]?.content).toContain("## Highlights");
    expect(out[0]?.content).toContain("Clicks rose");
    expect(out[1]?.fileName).toBe("gsc-report-mom-acme-1");
  });

  it("fails when meeting notes cannot be built", async () => {
    vi.mocked(resolveOpenRouterApiKeyForHarness).mockResolvedValueOnce("");
    await expect(
      resolveDriveUploadDeliverables({
        executionKind: "gsc_reporting",
        siteName: "Acme",
        summaryText: "",
        archiveFiles: [{ fileName: "gsc-report-mom-acme-1.md", content: REPORT_MD, mime: "text/markdown" }],
      }),
    ).rejects.toThrow("OpenRouter API key is required to build GSC meeting notes for Google Drive.");
  });

  it("returns no Drive files when GSC has no report", async () => {
    const out = await resolveDriveUploadDeliverables({
      executionKind: "gsc_reporting",
      siteName: "Acme",
      summaryText: "done",
      archiveFiles: [{ fileName: "mom-queries.csv", content: "a,b", mime: "text/csv" }],
    });
    expect(out).toEqual([]);
  });

  it("keeps a single primary file for non-GSC runs", async () => {
    const out = await resolveDriveUploadDeliverables({
      executionKind: "chatgpt_website_audit",
      summaryText: "",
      archiveFiles: [
        { fileName: "audit-final-report.md", content: "# Audit", mime: "text/markdown" },
        { fileName: "extra.csv", content: "a,b", mime: "text/csv" },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.fileName).toBe("audit-final-report");
  });
});

describe("resolvePrimaryDeliverable", () => {
  it("still returns only the GSC report for email and archive callers", () => {
    const one = resolvePrimaryDeliverable(
      [
        { fileName: "gsc-meeting-notes-yoy-acme-1.md", content: "# Notes", mime: "text/markdown" },
        { fileName: "gsc-report-yoy-acme-1.md", content: REPORT_MD, mime: "text/markdown" },
        { fileName: "mom-queries.csv", content: "a,b", mime: "text/csv" },
      ],
      "",
      undefined,
      { executionKind: "gsc_reporting" },
    );
    expect(one?.fileName).toBe("gsc-report-yoy-acme-1");
  });
});
