import type { BlogGeneratorSectionId } from "@/components/blog-generator/blog-generator-sections";
import type { AgentRun, AgentRunRecipeKey } from "@/lib/agent-runs-types";

const GSC_TASK_KEYWORDS = new Set(["gsc-mom-report", "gsc-yoy-report"]);
const POST_CREATOR_TASK_KEYWORDS = new Set(["monthly-post-creator-run", "monthly-3-posts-run"]);

export function resolveAgentRunRecipeKey(
  run: Pick<AgentRun, "recipeKey" | "plan" | "context">,
): AgentRunRecipeKey | string {
  const key = (run.recipeKey ?? "").trim();

  const comparePreset = String(run.plan?.clientRunContract?.comparePreset ?? "").trim();
  if (comparePreset === "mom" || comparePreset === "yoy") {
    return "gsc_reporting";
  }

  const taskKw = (run.context?.taskKeyword ?? "").trim();
  if (GSC_TASK_KEYWORDS.has(taskKw)) return "gsc_reporting";
  if (POST_CREATOR_TASK_KEYWORDS.has(taskKw)) return "post_creator";

  if (
    key === "gsc_reporting" ||
    key === "post_creator" ||
    key === "content_optimizer_bulk" ||
    key === "overview_pages_meta_batch"
  ) {
    return key;
  }

  return key || "content_optimizer_bulk";
}

export function agentRunGeneratorSection(recipeKey: string): BlogGeneratorSectionId {
  if (recipeKey === "gsc_reporting") return "report";
  if (recipeKey === "post_creator") return "bulk-csv";
  return "opt";
}

export function agentRunProgressHeading(recipeKey: string): string {
  if (recipeKey === "gsc_reporting") return "Report";
  if (recipeKey === "post_creator") return "";
  return "Current post";
}

export function agentRunOpenViewLabel(recipeKey: string): string {
  if (recipeKey === "gsc_reporting") return "Open report";
  if (recipeKey === "post_creator") return "Open posts";
  return "Open optimizer";
}

export function agentRunShowsUrlProgress(recipeKey: string): boolean {
  return (
    recipeKey === "content_optimizer_bulk" ||
    recipeKey === "overview_pages_meta_batch" ||
    !isKnownNonOptimizerRecipe(recipeKey)
  );
}

function isKnownNonOptimizerRecipe(recipeKey: string): recipeKey is AgentRunRecipeKey {
  return (
    recipeKey === "gsc_reporting" ||
    recipeKey === "post_creator" ||
    recipeKey === "content_optimizer_bulk" ||
    recipeKey === "overview_pages_meta_batch"
  );
}
