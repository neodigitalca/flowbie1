import type { FlowFreeformClarifyQuestion, FlowFreeformSectionPlan } from "@/lib/flow-freeform/flow-freeform-types";
import { FlowFreeformBody } from "@/components/manager/flow-freeform/FlowFreeformBody";
import { FlowFreeformToolbar } from "@/components/manager/flow-freeform/FlowFreeformToolbar";

export interface FlowFreeformWorkspaceProps {
  flowTitle: string;
  setFlowTitle: (v: string) => void;
  userGoalPrompt: string;
  onUserGoalPromptChange: (v: string) => void;
  clarificationQuestions: FlowFreeformClarifyQuestion[] | null;
  clarificationAnswers: Record<string, string>;
  onClarificationAnswersChange: (next: Record<string, string>) => void;
  sections: FlowFreeformSectionPlan[];
  onSectionsChange: React.Dispatch<React.SetStateAction<FlowFreeformSectionPlan[]>>;
  activeKnowledgeBaseText: string;
  finalMarkdown: string;
  isGenerating: boolean;
  onRunClarify: () => void;
  onEnhancePromptAuto?: () => Promise<boolean>;
  onRunOutline: () => void;
  onRunFullReport: () => void;
  onRunAllSections: () => void;
  onRebuildSection: (plan: FlowFreeformSectionPlan) => void;
  onRebuildAll: () => void;
  onAbort: () => void;
}

/** Legacy wrapper composing toolbar + body (Generator uses FlowGeneratorSection instead). */
export function FlowFreeformWorkspace({
  flowTitle,
  setFlowTitle,
  userGoalPrompt,
  onUserGoalPromptChange,
  clarificationQuestions,
  clarificationAnswers,
  onClarificationAnswersChange,
  sections,
  onSectionsChange,
  activeKnowledgeBaseText,
  finalMarkdown,
  isGenerating,
  onRunClarify,
  onEnhancePromptAuto,
  onRunOutline,
  onRunFullReport,
  onRunAllSections,
  onRebuildSection,
  onRebuildAll,
  onAbort,
}: FlowFreeformWorkspaceProps) {
  const pipelineBusy = isGenerating;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border/40 px-3 py-2">
        <FlowFreeformToolbar
          flowTitle={flowTitle}
          finalMarkdown={finalMarkdown}
          hasGoalPrompt={userGoalPrompt.trim().length > 0}
          sectionsCount={sections.length}
          pipelineBusy={pipelineBusy}
          onRunClarify={onRunClarify}
          onRunOutline={onRunOutline}
          onRunFullReport={onRunFullReport}
          onRunAllSections={onRunAllSections}
          onAbort={onAbort}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <FlowFreeformBody
          flowTitle={flowTitle}
          setFlowTitle={setFlowTitle}
          userGoalPrompt={userGoalPrompt}
          onUserGoalPromptChange={onUserGoalPromptChange}
          clarificationQuestions={clarificationQuestions}
          clarificationAnswers={clarificationAnswers}
          onClarificationAnswersChange={onClarificationAnswersChange}
          sections={sections}
          onSectionsChange={onSectionsChange}
          activeKnowledgeBaseText={activeKnowledgeBaseText}
          isGenerating={pipelineBusy}
          onEnhancePromptAuto={onEnhancePromptAuto}
          onRebuildSection={onRebuildSection}
          onRebuildAll={onRebuildAll}
        />
      </div>
    </div>
  );
}
