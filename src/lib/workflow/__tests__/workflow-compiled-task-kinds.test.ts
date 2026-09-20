import { describe, expect, it } from "vitest";
import { workflowActionStartsFromCompiledTask } from "@/lib/workflow/workflow-runner";

describe("workflowActionStartsFromCompiledTask", () => {
  it("starts Full AISEO and DFS from the compiled task", () => {
    expect(workflowActionStartsFromCompiledTask("content_optimizer")).toBe(true);
    expect(workflowActionStartsFromCompiledTask("dfs_llm_article_audit")).toBe(true);
  });

  it("leaves other actions on the direct start path", () => {
    expect(workflowActionStartsFromCompiledTask("gsc_reporting")).toBe(false);
    expect(workflowActionStartsFromCompiledTask("post_creator")).toBe(false);
  });
});
