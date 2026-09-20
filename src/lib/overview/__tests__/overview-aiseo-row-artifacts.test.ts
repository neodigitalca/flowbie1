import { describe, expect, it } from "vitest";
import {
  aiseoRowFilesForUpload,
  buildAiseoPostContentHtmlFile,
  buildAiseoRowDisplaySections,
  filterAiseoRowDisplayFiles,
  isAiseoFileSlotRunKind,
  mergeAiseoRowFinishFiles,
  resolveAiseoPipelineDownloadFile,
} from "@/lib/overview/overview-aiseo-row-artifacts";

describe("isAiseoFileSlotRunKind", () => {
  it("includes body harness runs but not research, aiAllMeta, or content optimize", () => {
    expect(isAiseoFileSlotRunKind("aiTitle")).toBe(true);
    expect(isAiseoFileSlotRunKind("aiMeta")).toBe(true);
    expect(isAiseoFileSlotRunKind("aiFaq")).toBe(true);
    expect(isAiseoFileSlotRunKind("aiAnswer")).toBe(true);
    expect(isAiseoFileSlotRunKind("wpUpload")).toBe(true);
    expect(isAiseoFileSlotRunKind("research")).toBe(false);
    expect(isAiseoFileSlotRunKind("aiAllMeta")).toBe(false);
    expect(isAiseoFileSlotRunKind("content")).toBe(false);
    expect(isAiseoFileSlotRunKind("contentKw")).toBe(false);
    expect(isAiseoFileSlotRunKind("entityKw")).toBe(false);
    expect(isAiseoFileSlotRunKind("aiFeaturedImage")).toBe(false);
  });
});

describe("buildAiseoPostContentHtmlFile", () => {
  it("names content file from url slug", () => {
    const file = buildAiseoPostContentHtmlFile(
      "https://example.com/blog/2026-cra-mail-in-policy/",
      "<p>Full body</p>",
    );
    expect(file?.name).toBe("content-2026-cra-mail-in-policy.html");
    expect(file?.content).toBe("<p>Full body</p>");
  });
});

describe("filterAiseoRowDisplayFiles", () => {
  it("keeps registry slots for aiAnswer", () => {
    expect(
      filterAiseoRowDisplayFiles("aiAnswer", [
        { name: "answer.html", content: "<section>" },
        { name: "content-page.html", content: "<full>" },
        { name: "wordpress.json", content: "{}" },
        { name: "noise.md", content: "x" },
      ]).map((file) => file.name),
    ).toEqual(["answer.html", "content-page.html", "wordpress.json"]);
  });

  it("keeps two slots for wpUpload", () => {
    expect(
      filterAiseoRowDisplayFiles("wpUpload", [
        { name: "content-page.html", content: "<full>" },
        { name: "upload-payload-page.json", content: "{}" },
        { name: "wordpress.json", content: "{}" },
      ]).map((file) => file.name),
    ).toEqual(["content-page.html", "wordpress.json"]);
  });
});

describe("buildAiseoRowDisplaySections", () => {
  it("exposes three fixed rows for aiTitle", () => {
    expect(
      buildAiseoRowDisplaySections("aiTitle", [{ status: "generating" }], []).map(
        (section) => section.title,
      ),
    ).toEqual(["AI titles", "Post content", "WordPress upload"]);
  });

  it("exposes three fixed rows for aiMeta", () => {
    expect(
      buildAiseoRowDisplaySections("aiMeta", [{ status: "generating" }], []).map(
        (section) => section.title,
      ),
    ).toEqual(["AI meta", "Post content", "WordPress upload"]);
  });

  it("exposes one keyword row for contentKw", () => {
    expect(
      buildAiseoRowDisplaySections("contentKw", [{ status: "generating" }], []).map(
        (section) => section.title,
      ),
    ).toEqual(["AI keywords (content)"]);
  });

  it("exposes three fixed rows for aiScenario", () => {
    expect(
      buildAiseoRowDisplaySections("aiScenario", [{ status: "generating" }], []).map(
        (section) => section.title,
      ),
    ).toEqual(["Case scenario", "Post content", "WordPress upload"]);
  });

  it("exposes two rows for wpUpload", () => {
    expect(
      buildAiseoRowDisplaySections("wpUpload", [], []).map((section) => section.title),
    ).toEqual(["Post content", "WordPress upload"]);
  });
});

describe("resolveAiseoPipelineDownloadFile", () => {
  it("resolves Post content from content-*.html", () => {
    const file = resolveAiseoPipelineDownloadFile("aiFaq", "Post content", [
      { name: "content-slug.html", content: "<p>body</p>", mimeType: "text/html" },
    ]);
    expect(file?.name).toBe("content-slug.html");
  });
});

describe("mergeAiseoRowFinishFiles", () => {
  it("keeps wordpress.json when finish runs after upload", () => {
    const files = mergeAiseoRowFinishFiles({
      runKind: "aiAnswer",
      url: "https://example.com/page",
      existingFiles: [
        {
          name: "answer.html",
          content: "<section>",
          mimeType: "text/html;charset=utf-8",
        },
        {
          name: "content-page.html",
          content: "<full>",
          mimeType: "text/html;charset=utf-8",
        },
        {
          name: "wordpress.json",
          content: '{"ok":true}',
          mimeType: "application/json",
        },
      ],
      elementFiles: [
        {
          name: "answer.html",
          content: "<section updated>",
          mimeType: "text/html;charset=utf-8",
        },
      ],
      postHtml: "<full updated>",
    });
    expect(files.map((file) => file.name)).toEqual([
      "answer.html",
      "content-page.html",
      "wordpress.json",
    ]);
  });
});

describe("aiseoRowFilesForUpload", () => {
  it("returns element and post content files for upload merge", () => {
    const files = aiseoRowFilesForUpload({
      runKind: "aiHeaders",
      url: "https://example.com/page",
      elementFiles: [
        {
          name: "headers-plan.json",
          content: "{}",
          mimeType: "application/json",
        },
      ],
      postHtml: "<p>optimized</p>",
    });
    expect(files.map((file) => file.name)).toEqual([
      "headers-plan.json",
      "content-page.html",
    ]);
  });
});
