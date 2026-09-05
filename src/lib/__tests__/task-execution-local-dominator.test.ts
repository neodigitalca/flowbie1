import { describe, expect, it } from "vitest";
import { taskExecutionLocalDominatorIsConfigured } from "@/lib/task-execution-bucket";

describe("taskExecutionLocalDominatorIsConfigured", () => {
  it("is configured with empty business and keyword (resolved at run time from site)", () => {
    expect(taskExecutionLocalDominatorIsConfigured({ businessName: "", keyword: "" })).toBe(true);
  });

  it("is configured with explicit overrides", () => {
    expect(
      taskExecutionLocalDominatorIsConfigured({
        businessName: "Advance Blinds",
        keyword: "blinds near me",
      }),
    ).toBe(true);
  });
});
