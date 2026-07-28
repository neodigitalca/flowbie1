import type { Dispatch, SetStateAction } from "react";
import type { AgentConfig } from "@/types/agent-config";
import type { GenerationResult } from "@/lib/api";
import type { FlowFreeformClarifyQuestion, FlowFreeformSectionPlan } from "@/lib/flow-freeform/flow-freeform-types";

/** Flow + Image generator state and handlers (owned by Index, passed into BlogGeneratorShell). */
export type GeneratorFreeFlowBindings = {
  flowTitle: string;
  setFlowTitle: (v: string) => void;
  apiKey: string;
  agents: AgentConfig[];
  selectedModel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  activeKnowledgeBaseText: string;
  userGoalPrompt: string;
  onUserGoalPromptChange: (v: string) => void;
  clarificationQuestions: FlowFreeformClarifyQuestion[] | null;
  clarificationAnswers: Record<string, string>;
  onClarificationAnswersChange: (next: Record<string, string>) => void;
  flowSections: FlowFreeformSectionPlan[];
  setFlowSections: Dispatch<SetStateAction<FlowFreeformSectionPlan[]>>;
  isGenerating: boolean;
  generationResult: GenerationResult;
  onAbort: () => void;
  onRunClarify: () => void;
  onEnhancePromptAuto?: () => Promise<boolean>;
  onRunOutline: () => void;
  onRunFullReport: () => void;
  onRunAllSections: () => void;
  onRebuildSection: (plan: FlowFreeformSectionPlan) => void;
  onRebuildAll: () => void;
  setGenerationResult: Dispatch<SetStateAction<GenerationResult>>;
};
