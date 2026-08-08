import type { AgentConfig } from "@/types/agent-config";

/** Stable id for the mandatory first "AI Overview" summary harness section. */
export const BLOG_HARNESS_SUMMARY_AGENT_ID = "ai-overview-summary";

/** Heading text used by the summary section (kept simple and scannable). */
export const BLOG_HARNESS_SUMMARY_TITLE = "Overview";

/**
 * Fixed last harness section: Google AI Overview-style block (prose only; scroll links inserted in code).
 * Prompt specifics live in `generateSingleSectionPrompt` (keyed by this agent id).
 */
export function buildBlogHarnessSummaryAgent(): AgentConfig {
  return {
    id: BLOG_HARNESS_SUMMARY_AGENT_ID,
    step: 1,
    title: BLOG_HARNESS_SUMMARY_TITLE,
    description:
      "Google AI Overview opener: 1-2 SEO lead paragraphs, then contextual scroll-link <ul> (one in-context # link per body H2). Never boilerplate \"see below\".",
    features: [],
    headingLevel: 1,
  };
}

export function isBlogHarnessSummaryAgent(agent: Pick<AgentConfig, "id" | "title">): boolean {
  if (agent.id === BLOG_HARNESS_SUMMARY_AGENT_ID) return true;
  // Guard against a blueprint emitting its own bare top "Summary" / "Overview" block that would duplicate ours.
  const title = (agent.title ?? "").trim().toLowerCase();
  return title === "summary" || title === "overview" || title === "ai overview";
}

/**
 * Guarantee the AI Overview summary agent is the first harness section for blog content.
 * - Press releases are returned unchanged (they use a fixed editorial spine).
 * - Any existing summary agents are removed, then a fresh one is prepended.
 * - `step` values are renumbered 1..n so downstream first-section logic stays correct.
 */
export function ensureBlogHarnessSummaryFirst(
  agents: AgentConfig[],
  contentKind?: "press_release",
): AgentConfig[] {
  if (contentKind === "press_release") return agents;

  const withoutSummary = agents.filter((a) => !isBlogHarnessSummaryAgent(a));
  const ordered = [buildBlogHarnessSummaryAgent(), ...withoutSummary];
  return ordered.map((agent, index) => ({ ...agent, step: index + 1 }));
}

/**
 * Guarantee the AI Overview summary agent is the **last** harness generation step for blog content.
 * Body H2 sections generate first; Overview prose runs last with known body anchors.
 * Published HTML still places Overview first when stitching.
 */
export function ensureBlogHarnessSummaryLast(
  agents: AgentConfig[],
  contentKind?: "press_release",
): AgentConfig[] {
  if (contentKind === "press_release") return agents;

  const withoutSummary = agents.filter((a) => !isBlogHarnessSummaryAgent(a));
  const ordered = [...withoutSummary, buildBlogHarnessSummaryAgent()];
  return ordered.map((agent, index) => ({ ...agent, step: index + 1 }));
}

export function splitBlogHarnessBodyAndOverview(agents: AgentConfig[]): {
  bodyAgents: AgentConfig[];
  overviewAgent: AgentConfig | undefined;
} {
  const overview = agents.find((a) => isBlogHarnessSummaryAgent(a));
  const bodyAgents = agents.filter((a) => !isBlogHarnessSummaryAgent(a));
  return { bodyAgents, overviewAgent: overview };
}
