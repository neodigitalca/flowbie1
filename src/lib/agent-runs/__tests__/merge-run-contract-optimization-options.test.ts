import { describe, expect, it } from "vitest";
import { mergeRunContractOptimizationOptions } from "@/lib/agent-runs/merge-run-contract-optimization-options";

describe("mergeRunContractOptimizationOptions", () => {
  it("keeps New research when the node payload has it and the server contract does not", () => {
    const merged = mergeRunContractOptimizationOptions(
      { optimizationOptions: { forceNewResearch: true, optimizeContent: true } },
      { optimizationOptions: { optimizeTitle: true, optimizeContent: true } },
    );
    expect(merged.forceNewResearch).toBe(true);
    expect(merged.optimizeContent).toBe(true);
  });

  it("stays Saved brief when neither side asks for new research", () => {
    const merged = mergeRunContractOptimizationOptions(
      { optimizationOptions: { optimizeContent: true } },
      { optimizationOptions: { optimizeMeta: true } },
    );
    expect(merged.forceNewResearch).toBe(false);
  });
});
