import type { AgentConfig } from "@/types/agent-config";

/** Stable id for the mandatory direct-answer harness section (before Overview). */
export const BLOG_HARNESS_ANSWER_AGENT_ID = "direct-answer";

/** Fixed anchor id for the Answer H2. */
export const HARNESS_ANSWER_ANCHOR_ID = "answer";

/** Heading text for the direct-answer section. */
export const BLOG_HARNESS_ANSWER_TITLE = "Answer";

/**
 * Synthetic harness section: two-sentence direct answer before Overview.
 * Prompt specifics live in `generateSingleSectionPrompt` (keyed by this agent id).
 */
export function buildBlogHarnessAnswerAgent(): AgentConfig {
  return {
    id: BLOG_HARNESS_ANSWER_AGENT_ID,
    step: 0,
    title: BLOG_HARNESS_ANSWER_TITLE,
    description:
      "Direct answer: two or three sentences in one paragraph. Stat/fact first in sentence 1; sourced cost/ROI figure in sentence 2 when sources provide it; final sentence names the connected business plus one concrete installer constraint from listed sources. Never hollow team speak.",
    features: [],
    headingLevel: 1,
  };
}

export function isBlogHarnessAnswerAgent(agent: Pick<AgentConfig, "id" | "title">): boolean {
  if (agent.id === BLOG_HARNESS_ANSWER_AGENT_ID) return true;
  const title = (agent.title ?? "").trim().toLowerCase();
  return title === "answer" || title === "direct answer";
}
