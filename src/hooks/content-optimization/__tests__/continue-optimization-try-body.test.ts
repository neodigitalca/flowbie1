import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const tryBodyPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../continue-optimization-try-body.ts",
);

describe("continue-optimization-try-body one generate path", () => {
  it("uses generateBlueprintFlow then generateAndUploadFlow for every row", () => {
    const src = readFileSync(tryBodyPath, "utf8");
    expect(src).toMatch(/generateBlueprintFlow/);
    expect(src).toMatch(/generateAndUploadFlow/);
    expect(src).not.toMatch(/runOptimizeViaBulkGenerate/);
    expect(src).not.toMatch(/if \(isSapRun\)/);
    expect(src).not.toMatch(/optimize-via-bulk-generate/);
  });

  it("still ensures stored SEO research before generate", () => {
    const src = readFileSync(tryBodyPath, "utf8");
    expect(src).toMatch(/ensureSeoResearchBriefForOptimize/);
    expect(src).toMatch(/buildOptimizeSelectionsFromStoredBrief/);
    expect(src).toMatch(/isAgentRunBatchKey\(batchKey\)/);
    expect(src).not.toMatch(/performKeywordResearchFlow/);
    expect(src).not.toMatch(/runTopicResearchFanout/);
  });
});
