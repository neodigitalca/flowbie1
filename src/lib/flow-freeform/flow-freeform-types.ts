import type { AgentConfig } from "@/types/agent-config";

export const FLOW_BLUEPRINT_VERSION = 2 as const;

export type FlowFreeformSectionPlan = {
  id: string;
  h2Title: string;
  ragQuery: string;
  writerPrompt: string;
};

export type FlowFreeformClarifyQuestion = {
  id: string;
  text: string;
  options: string[];
};

export type FlowFreeformClarifyResult = {
  questions: FlowFreeformClarifyQuestion[];
};

export type FlowFreeformOutlineResult = {
  sections: FlowFreeformSectionPlan[];
};

export type FlowFreeformSectionBody = {
  plan: FlowFreeformSectionPlan;
  index: number;
  markdownBlock: string;
};

/** Map persisted sections to legacy AgentConfig for Output tab / prompt builders. */
export function flowFreeformSectionsToAgents(sections: FlowFreeformSectionPlan[]): AgentConfig[] {
  return sections.map((s, i) => ({
    id: s.id,
    step: i + 1,
    title: s.h2Title,
    description: s.writerPrompt,
    features: [] as string[],
    h2Count: 1,
    h3Count: 0,
    h3Enabled: false,
    headingLevel: 2,
  }));
}
