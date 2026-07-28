import { TrendingUp } from "lucide-react";
import { BlogGeneratorWorkspaceChrome } from "@/components/blog-generator/BlogGeneratorWorkspaceChrome";
import {
  GENERATOR_WORKSPACE_TITLE,
  type BlogGeneratorSectionId,
} from "@/components/blog-generator/blog-generator-sections";
import type { GeneratorFreeFlowBindings } from "@/components/generator/generator-free-flow-bindings";
import { FlowFreeformBody } from "@/components/manager/flow-freeform/FlowFreeformBody";
import { FlowFreeformToolbar } from "@/components/manager/flow-freeform/FlowFreeformToolbar";
import {
  SEO_WORKSPACE_BODY_SCROLL_CLASS,
  SEO_WORKSPACE_HEADER_CLASS,
  SEO_WORKSPACE_SHELL_CLASS,
} from "@/components/seo/seo-workspace-layout";

export type FlowGeneratorSectionProps = {
  activeSection: BlogGeneratorSectionId;
  onSectionChange: (id: BlogGeneratorSectionId) => void;
  bindings: GeneratorFreeFlowBindings;
  onResetBlueprint?: () => void;
};

export function FlowGeneratorSection({
  activeSection,
  onSectionChange,
  bindings,
  onResetBlueprint,
}: FlowGeneratorSectionProps) {
  const pipelineBusy = bindings.isGenerating;

  return (
    <div className={SEO_WORKSPACE_SHELL_CLASS}>
      <div className={SEO_WORKSPACE_HEADER_CLASS}>
        <BlogGeneratorWorkspaceChrome
          icon={TrendingUp}
          title={GENERATOR_WORKSPACE_TITLE}
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          sectionSwitchDisabled={pipelineBusy}
          workspaceBusy={pipelineBusy}
          progressSnapshot={null}
          canOpenDetails={false}
          isProcessing={pipelineBusy}
          detailsPanelId="flow-generator-details"
          toolbar={
            <FlowFreeformToolbar
              flowTitle={bindings.flowTitle}
              finalMarkdown={bindings.generationResult.final}
              hasGoalPrompt={bindings.userGoalPrompt.trim().length > 0}
              sectionsCount={bindings.flowSections.length}
              pipelineBusy={pipelineBusy}
              onRunClarify={bindings.onRunClarify}
              onRunOutline={bindings.onRunOutline}
              onRunFullReport={bindings.onRunFullReport}
              onRunAllSections={bindings.onRunAllSections}
              onAbort={bindings.onAbort}
              onResetBlueprint={onResetBlueprint}
            />
          }
          detailsPanel={null}
        />
      </div>
      <div className={SEO_WORKSPACE_BODY_SCROLL_CLASS}>
        <FlowFreeformBody
          flowTitle={bindings.flowTitle}
          setFlowTitle={bindings.setFlowTitle}
          userGoalPrompt={bindings.userGoalPrompt}
          onUserGoalPromptChange={bindings.onUserGoalPromptChange}
          clarificationQuestions={bindings.clarificationQuestions}
          clarificationAnswers={bindings.clarificationAnswers}
          onClarificationAnswersChange={bindings.onClarificationAnswersChange}
          sections={bindings.flowSections}
          onSectionsChange={bindings.setFlowSections}
          activeKnowledgeBaseText={bindings.activeKnowledgeBaseText}
          isGenerating={pipelineBusy}
          onEnhancePromptAuto={bindings.onEnhancePromptAuto}
          onRebuildSection={bindings.onRebuildSection}
          onRebuildAll={bindings.onRebuildAll}
        />
      </div>
    </div>
  );
}
