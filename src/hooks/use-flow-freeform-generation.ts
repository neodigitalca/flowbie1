import { useCallback, useRef, useState } from "react";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_ANSWER_CLARIFICATION_QUESTIONS_THEN_CLIC, NOTIFY_ANSWER_THE_QUESTIONS_THEN_CONTINUE, NOTIFY_ENTER_A_GOAL_PROMPT_FIRST, NOTIFY_GENERATION_ABORTED, NOTIFY_GOAL_PROMPT_UPDATED, NOTIFY_NO_CLARIFICATION_NEEDED_RUN_OUTLINE_OR_F, NOTIFY_REPORT_GENERATED, NOTIFY_SET_YOUR_OPENROUTER_API_KEY_IN_THE_MANAG, notifyOutlineReadyXSections, notifyRebuiltX } from "@/lib/notify-messages";
import type { GenerationResult } from "@/lib/api";
import { checkAborted } from "@/lib/agent-generation-helpers";
import {
  buildPlanMarkdownDoc,
  runFlowFreeformClarify,
  runFlowFreeformEnhanceGoalPrompt,
  runFlowFreeformOneSection,
  runFlowFreeformOutline,
  runFlowFreeformSuggestTitle,
  stitchSectionMarkdown,
} from "@/lib/flow-freeform/flow-freeform-pipeline";
import type { FlowFreeformClarifyQuestion, FlowFreeformSectionPlan } from "@/lib/flow-freeform/flow-freeform-types";

type SetGen = React.Dispatch<React.SetStateAction<GenerationResult>>;

function stitchFromMap(ordered: FlowFreeformSectionPlan[], bodies: Record<string, string>): string {
  const parts: { plan: FlowFreeformSectionPlan; index: number; markdownBlock: string }[] = [];
  ordered.forEach((plan, index) => {
    const md = bodies[plan.id];
    if (md) parts.push({ plan, index, markdownBlock: md });
  });
  return stitchSectionMarkdown(parts);
}

export interface UseFlowFreeformGenerationArgs {
  apiKey: string;
  selectedModel: string;
  flowTitle: string;
  flowPurpose: string;
  activeKnowledgeBaseText: string;
  userGoalPrompt: string;
  clarificationAnswers: Record<string, string>;
  setFlowTitle: (title: string) => void;
  setUserGoalPrompt: (prompt: string) => void;
  setClarificationQuestions: (q: FlowFreeformClarifyQuestion[] | null) => void;
  setSections: React.Dispatch<React.SetStateAction<FlowFreeformSectionPlan[]>>;
  setSectionBodies: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  currentAbortController: React.MutableRefObject<AbortController | null>;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  setGenerationResult: SetGen;
}

export function useFlowFreeformGeneration({
  apiKey,
  selectedModel,
  flowTitle,
  flowPurpose,
  activeKnowledgeBaseText,
  userGoalPrompt,
  clarificationAnswers,
  setFlowTitle,
  setUserGoalPrompt,
  setClarificationQuestions,
  setSections,
  setSectionBodies,
  currentAbortController,
  setIsGenerating,
  setGenerationResult,
}: UseFlowFreeformGenerationArgs) {
  const [isClarifying, setIsClarifying] = useState(false);
  const kbRef = useRef(activeKnowledgeBaseText);
  kbRef.current = activeKnowledgeBaseText;

  const resolveFlowTitleForGeneration = useCallback(
    async (opts: { signal?: AbortSignal; h2Fallback?: string | null }): Promise<string> => {
      const existing = flowTitle.trim();
      if (existing) return existing;
      if (userGoalPrompt.trim()) {
        const raw = await runFlowFreeformSuggestTitle({
          apiKey,
          model: selectedModel,
          userGoalPrompt,
          kbText: kbRef.current,
          signal: opts.signal,
        });
        const clean = raw.trim() || "Report";
        setFlowTitle(clean);
        return clean;
      }
      const fb = opts.h2Fallback?.trim();
      if (fb) {
        setFlowTitle(fb);
        return fb;
      }
      const fallback = "Untitled report";
      setFlowTitle(fallback);
      return fallback;
    },
    [apiKey, selectedModel, flowTitle, userGoalPrompt, setFlowTitle],
  );

  const handleAbort = useCallback(() => {
    if (currentAbortController.current) {
      currentAbortController.current.abort();
      currentAbortController.current = null;
      setIsGenerating(false);
      setGenerationResult((prev) => ({
        ...prev,
        currentStage: "error",
        final: (prev.final || "") + "\n\n--- Generation aborted ---",
      }));
      notify.warning(NOTIFY_GENERATION_ABORTED);
    }
  }, [currentAbortController, setIsGenerating, setGenerationResult]);

  const runClarifyOnly = useCallback(async () => {
    if (!apiKey.trim()) {
      notify.error(NOTIFY_SET_YOUR_OPENROUTER_API_KEY_IN_THE_MANAG);
      return;
    }
    if (!userGoalPrompt.trim()) {
      notify.error(NOTIFY_ENTER_A_GOAL_PROMPT_FIRST);
      return;
    }
    const kb = kbRef.current;
    const c = new AbortController();
    currentAbortController.current = c;
    setIsClarifying(true);
    try {
      const resolvedTitle = await resolveFlowTitleForGeneration({ signal: c.signal });
      const r = await runFlowFreeformClarify({
        apiKey,
        model: selectedModel,
        flowTitle: resolvedTitle,
        flowPurpose,
        userGoalPrompt,
        kbText: kb,
        signal: c.signal,
      });
      checkAborted(c.signal);
      setClarificationQuestions(r.questions.length ? r.questions : null);
      if (r.questions.length === 0) {
        notify.success(NOTIFY_NO_CLARIFICATION_NEEDED_RUN_OUTLINE_OR_F);
      } else {
        notify.info(NOTIFY_ANSWER_THE_QUESTIONS_THEN_CONTINUE);
      }
    } catch (e) {
      if ((e as Error).message !== "Aborted") {
        notify.error((e as Error).message || "Clarify failed");
      }
    } finally {
      setIsClarifying(false);
      currentAbortController.current = null;
    }
  }, [
    apiKey,
    selectedModel,
    flowPurpose,
    userGoalPrompt,
    resolveFlowTitleForGeneration,
    setClarificationQuestions,
    currentAbortController,
  ]);

  const runEnhanceGoalPrompt = useCallback(async (opts?: { silent?: boolean }): Promise<boolean> => {
    if (!apiKey.trim()) {
      notify.error(NOTIFY_SET_YOUR_OPENROUTER_API_KEY_IN_THE_MANAG);
      return false;
    }
    if (!userGoalPrompt.trim()) {
      if (!opts?.silent) notify.error(NOTIFY_ENTER_A_GOAL_PROMPT_FIRST);
      return false;
    }
    const c = new AbortController();
    currentAbortController.current = c;
    setIsGenerating(true);
    setGenerationResult((prev) => ({ ...prev, currentStage: "planning" }));
    try {
      const resolvedTitle = await resolveFlowTitleForGeneration({ signal: c.signal });
      const enhanced = await runFlowFreeformEnhanceGoalPrompt({
        apiKey,
        model: selectedModel,
        flowTitle: resolvedTitle,
        userGoalPrompt,
        clarificationAnswers,
        kbText: kbRef.current,
        signal: c.signal,
      });
      checkAborted(c.signal);
      const next = enhanced.trim() || userGoalPrompt;
      setUserGoalPrompt(next);
      setGenerationResult((prev) => ({ ...prev, currentStage: "idle" }));
      if (!opts?.silent) {
        notify.success(NOTIFY_GOAL_PROMPT_UPDATED);
      }
      return true;
    } catch (e) {
      if ((e as Error).message !== "Aborted") {
        notify.error((e as Error).message || "Enhance failed");
        setGenerationResult((prev) => ({ ...prev, currentStage: "error", final: String(e) }));
      }
      return false;
    } finally {
      setIsGenerating(false);
      currentAbortController.current = null;
    }
  }, [
    apiKey,
    selectedModel,
    userGoalPrompt,
    clarificationAnswers,
    resolveFlowTitleForGeneration,
    setUserGoalPrompt,
    currentAbortController,
    setIsGenerating,
    setGenerationResult,
  ]);

  const runOutlineOnly = useCallback(async () => {
    if (!apiKey.trim()) {
      notify.error(NOTIFY_SET_YOUR_OPENROUTER_API_KEY_IN_THE_MANAG);
      return;
    }
    if (!userGoalPrompt.trim()) {
      notify.error(NOTIFY_ENTER_A_GOAL_PROMPT_FIRST);
      return;
    }
    const kb = kbRef.current;
    const c = new AbortController();
    currentAbortController.current = c;
    setIsGenerating(true);
    setGenerationResult((prev) => ({ ...prev, currentStage: "planning" }));
    try {
      const resolvedTitle = await resolveFlowTitleForGeneration({ signal: c.signal });
      const plans = await runFlowFreeformOutline({
        apiKey,
        model: selectedModel,
        flowTitle: resolvedTitle,
        flowPurpose,
        userGoalPrompt,
        clarificationAnswers,
        kbText: kb,
        signal: c.signal,
      });
      checkAborted(c.signal);
      setSections(plans);
      setSectionBodies({});
      const planMd = buildPlanMarkdownDoc(plans);
      setGenerationResult({
        plan: planMd,
        draft: "",
        final: "",
        currentStage: "idle",
        isGenerating: false,
      });
      notify.success(notifyOutlineReadyXSections(plans.length));
    } catch (e) {
      if ((e as Error).message !== "Aborted") {
        notify.error((e as Error).message || "Outline failed");
        setGenerationResult((prev) => ({ ...prev, currentStage: "error", final: String(e) }));
      }
    } finally {
      setIsGenerating(false);
      currentAbortController.current = null;
    }
  }, [
    apiKey,
    selectedModel,
    flowPurpose,
    userGoalPrompt,
    clarificationAnswers,
    resolveFlowTitleForGeneration,
    setSections,
    setSectionBodies,
    currentAbortController,
    setIsGenerating,
    setGenerationResult,
  ]);

  const runAllSections = useCallback(
    async (plans: FlowFreeformSectionPlan[]) => {
      if (!apiKey.trim() || plans.length === 0) return;
      const kb = kbRef.current;
      const c = new AbortController();
      currentAbortController.current = c;
      setIsGenerating(true);
      try {
        const planMd = buildPlanMarkdownDoc(plans);
        setGenerationResult((prev) => ({
          ...prev,
          currentStage: "drafting",
          plan: planMd,
        }));
        const resolvedTitle = await resolveFlowTitleForGeneration({
          signal: c.signal,
          h2Fallback: plans[0]?.h2Title ?? null,
        });
        const bodies: { plan: FlowFreeformSectionPlan; index: number; markdownBlock: string }[] = [];
        const bodyMap: Record<string, string> = {};
        for (let i = 0; i < plans.length; i++) {
          checkAborted(c.signal);
          const plan = plans[i]!;
          const b = await runFlowFreeformOneSection({
            apiKey,
            model: selectedModel,
            flowTitle: resolvedTitle,
            flowPurpose,
            kbText: kb,
            plan,
            index: i,
            signal: c.signal,
          });
          bodies.push(b);
          bodyMap[plan.id] = b.markdownBlock;
          const stitched = stitchSectionMarkdown(bodies);
          setGenerationResult((prev) => ({
            ...prev,
            plan: planMd,
            draft: stitched,
            final: stitched,
            currentStage: "drafting",
          }));
          setSectionBodies({ ...bodyMap });
        }
        checkAborted(c.signal);
        const stitched = stitchSectionMarkdown(bodies);
        setGenerationResult({
          plan: planMd,
          draft: stitched,
          final: stitched,
          currentStage: "complete",
          isGenerating: false,
        });
        notify.success(NOTIFY_REPORT_GENERATED);
      } catch (e) {
        if ((e as Error).message !== "Aborted") {
          notify.error((e as Error).message || "Section generation failed");
          setGenerationResult((prev) => ({ ...prev, currentStage: "error" }));
        }
      } finally {
        setIsGenerating(false);
        currentAbortController.current = null;
      }
    },
    [apiKey, selectedModel, flowPurpose, resolveFlowTitleForGeneration, currentAbortController, setIsGenerating, setGenerationResult, setSectionBodies]
  );

  const runFullPipeline = useCallback(async () => {
    if (!apiKey.trim()) {
      notify.error(NOTIFY_SET_YOUR_OPENROUTER_API_KEY_IN_THE_MANAG);
      return;
    }
    if (!userGoalPrompt.trim()) {
      notify.error(NOTIFY_ENTER_A_GOAL_PROMPT_FIRST);
      return;
    }
    const kb = kbRef.current;
    const c = new AbortController();
    currentAbortController.current = c;
    setIsGenerating(true);
    setGenerationResult({ plan: "", draft: "", final: "", currentStage: "planning", isGenerating: true });
    try {
      const resolvedTitle = await resolveFlowTitleForGeneration({ signal: c.signal });
      const clar = await runFlowFreeformClarify({
        apiKey,
        model: selectedModel,
        flowTitle: resolvedTitle,
        flowPurpose,
        userGoalPrompt,
        kbText: kb,
        signal: c.signal,
      });
      checkAborted(c.signal);
      if (clar.questions.length > 0) {
        const unanswered = clar.questions.some((q) => !clarificationAnswers[q.id]?.trim());
        if (unanswered) {
          setClarificationQuestions(clar.questions);
          setIsGenerating(false);
          currentAbortController.current = null;
          notify.info(NOTIFY_ANSWER_CLARIFICATION_QUESTIONS_THEN_CLIC);
          return;
        }
      } else {
        setClarificationQuestions(null);
      }

      const plans = await runFlowFreeformOutline({
        apiKey,
        model: selectedModel,
        flowTitle: resolvedTitle,
        flowPurpose,
        userGoalPrompt,
        clarificationAnswers,
        kbText: kb,
        signal: c.signal,
      });
      checkAborted(c.signal);
      setSections(plans);
      setSectionBodies({});

      const planMd = buildPlanMarkdownDoc(plans);
      setGenerationResult((prev) => ({ ...prev, plan: planMd, currentStage: "drafting" }));

      const bodies: { plan: FlowFreeformSectionPlan; index: number; markdownBlock: string }[] = [];
      const bodyMap: Record<string, string> = {};
      for (let i = 0; i < plans.length; i++) {
        checkAborted(c.signal);
        const plan = plans[i]!;
        const b = await runFlowFreeformOneSection({
          apiKey,
          model: selectedModel,
          flowTitle: resolvedTitle,
          flowPurpose,
          kbText: kb,
          plan,
          index: i,
          signal: c.signal,
        });
        bodies.push(b);
        bodyMap[plan.id] = b.markdownBlock;
        const stitched = stitchSectionMarkdown(bodies);
        setGenerationResult((prev) => ({
          ...prev,
          plan: planMd,
          draft: stitched,
          final: stitched,
          currentStage: "drafting",
        }));
        setSectionBodies({ ...bodyMap });
      }

      const stitched = stitchSectionMarkdown(bodies);
      setGenerationResult({
        plan: planMd,
        draft: stitched,
        final: stitched,
        currentStage: "complete",
        isGenerating: false,
      });
      setClarificationQuestions(null);
      notify.success(NOTIFY_REPORT_GENERATED);
    } catch (e) {
      if ((e as Error).message !== "Aborted") {
        notify.error((e as Error).message || "Pipeline failed");
        setGenerationResult((prev) => ({ ...prev, currentStage: "error", final: String(e) }));
      }
    } finally {
      setIsGenerating(false);
      currentAbortController.current = null;
    }
  }, [
    apiKey,
    selectedModel,
    flowPurpose,
    userGoalPrompt,
    clarificationAnswers,
    resolveFlowTitleForGeneration,
    setClarificationQuestions,
    setSections,
    setSectionBodies,
    currentAbortController,
    setIsGenerating,
    setGenerationResult,
  ]);

  const rebuildOneSection = useCallback(
    async (plan: FlowFreeformSectionPlan, orderedPlans: FlowFreeformSectionPlan[]) => {
      if (!apiKey.trim()) return;
      const kb = kbRef.current;
      const c = new AbortController();
      currentAbortController.current = c;
      setIsGenerating(true);
      try {
        const resolvedTitle = await resolveFlowTitleForGeneration({
          signal: c.signal,
          h2Fallback: plan.h2Title,
        });
        const b = await runFlowFreeformOneSection({
          apiKey,
          model: selectedModel,
          flowTitle: resolvedTitle,
          flowPurpose,
          kbText: kb,
          plan,
          index: orderedPlans.findIndex((p) => p.id === plan.id),
          signal: c.signal,
        });
        setSectionBodies((prev) => {
          const next = { ...prev, [plan.id]: b.markdownBlock };
          const stitched = stitchFromMap(orderedPlans, next);
          const planMd = buildPlanMarkdownDoc(orderedPlans);
          setGenerationResult({
            plan: planMd,
            draft: stitched,
            final: stitched,
            currentStage: "complete",
            isGenerating: false,
          });
          return next;
        });
        notify.success(notifyRebuiltX(plan.h2Title));
      } catch (e) {
        if ((e as Error).message !== "Aborted") {
          notify.error((e as Error).message || "Rebuild failed");
        }
      } finally {
        setIsGenerating(false);
        currentAbortController.current = null;
      }
    },
    [apiKey, selectedModel, flowPurpose, resolveFlowTitleForGeneration, currentAbortController, setIsGenerating, setSectionBodies, setGenerationResult]
  );

  const rebuildAllSections = useCallback(
    async (orderedPlans: FlowFreeformSectionPlan[]) => {
      await runAllSections(orderedPlans);
    },
    [runAllSections]
  );

  return {
    handleAbort,
    runClarifyOnly,
    runEnhanceGoalPrompt,
    runOutlineOnly,
    runAllSections,
    runFullPipeline,
    rebuildOneSection,
    rebuildAllSections,
    isClarifying,
  };
}
