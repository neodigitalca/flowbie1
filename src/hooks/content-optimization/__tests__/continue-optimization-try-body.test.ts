import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const tryBodyPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../continue-optimization-try-body.ts",
);

describe("continue-optimization-try-body gscResult regression", () => {
  it("destructures gscResult from input before passing to performKeywordResearchFlow", () => {
    const src = readFileSync(tryBodyPath, "utf8");
    expect(src).toMatch(/gscResult,\s*\n\s*existingPost/);
    expect(src).toMatch(/performKeywordResearchFlow\([\s\S]*?\bgscResult\b/);
  });
});
