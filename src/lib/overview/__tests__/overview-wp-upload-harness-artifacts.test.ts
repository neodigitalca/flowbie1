import { describe, expect, it } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import { createEmptyOverviewRow } from "@/lib/overview/overview-row-helpers";
import {
  buildOverviewRowWpUploadProofFiles,
  isWordPressUploadProofFileName,
  wpUploadHarnessGeneratedFiles,
} from "@/lib/overview/overview-wp-upload-harness-artifacts";

describe("isWordPressUploadProofFileName", () => {
  it("matches wordpress.json and upload-payload files", () => {
    expect(isWordPressUploadProofFileName("wordpress.json")).toBe(true);
    expect(isWordPressUploadProofFileName("upload-payload-junk-removal-types.json")).toBe(true);
    expect(isWordPressUploadProofFileName("blueprint-solar.json")).toBe(false);
    expect(isWordPressUploadProofFileName("content-html.md")).toBe(false);
  });
});

describe("wpUploadHarnessGeneratedFiles", () => {
  it("emits upload-payload and wordpress.json", () => {
    const files = wpUploadHarnessGeneratedFiles(
      "https://example.com/junk-removal-types/",
      '{"postId":1}',
      '{"success":true}',
    );
    expect(files.map((f) => f.name)).toEqual([
      "upload-payload-junk-removal-types.json",
      "wordpress.json",
    ]);
  });
});

describe("buildOverviewRowWpUploadProofFiles", () => {
  it("emits wordpress.json on skip", () => {
    const site = {
      id: "site-1",
      name: "Test",
      siteUrl: "https://example.com",
      username: "u",
      appPassword: "p",
      connectedAt: 0,
    } as WordPressSite;
    const files = buildOverviewRowWpUploadProofFiles({
      site,
      row: createEmptyOverviewRow("https://example.com/blinds"),
      inventoryContent: "",
      ok: false,
      skipped: true,
      error: "No research brief for this row.",
      uploadedAt: "2026-09-09T00:00:00.000Z",
    });
    expect(files.some((f) => f.name === "wordpress.json")).toBe(true);
    const doc = JSON.parse(files.find((f) => f.name === "wordpress.json")!.content);
    expect(doc.skipped).toBe(true);
    expect(doc.skipReason).toBe("No research brief for this row.");
  });
});
