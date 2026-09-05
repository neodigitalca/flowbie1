import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const tryBodyPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../continue-optimization-try-body.ts",
);
const bulkAutoGeneratePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../lib/bulk-auto-generate.ts",
);

describe("continue-optimization-try-body bulk generate path", () => {
  it("routes SAP runs through runOptimizeViaBulkGenerate", () => {
    const src = readFileSync(tryBodyPath, "utf8");
    expect(src).toMatch(/runOptimizeViaBulkGenerate/);
    expect(src).toMatch(/if \(isSapRun\)/);
  });

  it("keeps blog optimize on blueprint flow", () => {
    const src = readFileSync(tryBodyPath, "utf8");
    expect(src).toMatch(/generateBlueprintFlow/);
    expect(src).toMatch(/generateAndUploadFlow/);
  });

  it("still ensures stored SEO research before generate", () => {
    const src = readFileSync(tryBodyPath, "utf8");
    expect(src).toMatch(/ensureSeoResearchBriefForOptimize/);
    expect(src).toMatch(/buildOptimizeSelectionsFromStoredBrief/);
    expect(src).not.toMatch(/performKeywordResearchFlow/);
    expect(src).not.toMatch(/runTopicResearchFanout/);
  });
});

describe("bulk-auto-generate optimize upload", () => {
  it("supports updateTargetPostId via updateWordPressPost branch", () => {
    const src = readFileSync(bulkAutoGeneratePath, "utf8");
    expect(src).toMatch(/updateTargetPostId/);
    expect(src).toMatch(/isOptimizeUpdate/);
    expect(src).toMatch(/updateWordPressPost\(/);
    expect(src).toMatch(/createWordPressPost\(/);
  });
});
