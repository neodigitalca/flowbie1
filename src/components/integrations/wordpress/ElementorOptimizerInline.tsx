import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_CHECKLIST_IS_EMPTY_OR_MISSING_PAGE_DATA, NOTIFY_CHECKLIST_READY_REVIEW_AND_CLICK_CREATE_, NOTIFY_CREATING_ELEMENTOR_PLAN_AND_UPDATING_PAG, NOTIFY_FAILED_TO_BUILD_LAYOUT_FROM_CHECKLIST_TR, NOTIFY_PAGE_LAYOUT_UPDATED_SUCCESSFULLY, NOTIFY_SELECT_A_PAGE_FIRST } from "@/lib/notify-messages";
import { Loader2, Sparkles, CheckCircle2, Circle } from "lucide-react";
import type { WordPressSite } from "../types";
import { fetchElementorPage, fetchElementorMcpTools, applyElementorOptimization } from "@/lib/elementor-api";
import {
  runDesignBreakdownAgent,
  runOptimizationPlanAgentPhase1,
  buildLayoutFromChecklist,
  type OptimizationPlan,
} from "@/lib/elementor-optimizer";
import { ElementorOptimizationPlanDialog, type ElementorPlanPhase } from "../elementor/ElementorOptimizationPlanDialog";
import { UnifiedContentSelector } from "./UnifiedContentSelector";

const STEPS = [
  { key: "fetching", label: "Read page data (WordPress / Elementor MCP)" },
  { key: "breakdown", label: "Analyzing layout (design breakdown)" },
  { key: "plan", label: "Suggesting checklist" },
  { key: "done", label: "Review checklist, then create plan and update page" },
] as const;

interface ElementorOptimizerInlineProps {
  site: WordPressSite;
  disabled?: boolean;
}

export const ElementorOptimizerInline: React.FC<ElementorOptimizerInlineProps> = ({
  site,
  disabled = false,
}) => {
  const [selectedLink, setSelectedLink] = useState("");
  const [selectedPostData, setSelectedPostData] = useState<{
    id: number;
    subtype: string;
    link: string;
    slug?: string;
    endpoint?: string;
  } | null>(null);
  const [step, setStep] = useState<"idle" | "fetching" | "breakdown" | "plan" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [plan, setPlan] = useState<OptimizationPlan | null>(null);
  const [pendingContext, setPendingContext] = useState<{
    site: WordPressSite;
    postId: number;
  } | null>(null);
  const [pendingOriginalElementorJson, setPendingOriginalElementorJson] = useState<string | null>(null);

  const handleAnalyze = useCallback(async () => {
    if (!selectedPostData?.id) {
      notify.error(NOTIFY_SELECT_A_PAGE_FIRST);
      return;
    }
    setError(null);
    setPlan(null);
    setPlanDialogOpen(true);
    setStep("fetching");
    try {
      const [pageResult, mcpToolsList] = await Promise.all([
        fetchElementorPage(site, String(selectedPostData.id)),
        fetchElementorMcpTools(site).catch(() => []),
      ]);
      setStep("breakdown");
      const breakdown = await runDesignBreakdownAgent(
        typeof pageResult.rawElementorData === "string"
          ? pageResult.rawElementorData
          : JSON.stringify(pageResult.elementorData),
        { siteId: site.id }
      );
      setStep("plan");
      const elementorJson =
        typeof pageResult.rawElementorData === "string"
          ? pageResult.rawElementorData
          : JSON.stringify(pageResult.elementorData);
      const phase1 = await runOptimizationPlanAgentPhase1(breakdown, elementorJson, {
        siteId: site.id,
        mcpToolsList: mcpToolsList.length > 0 ? mcpToolsList : undefined,
      });
      setPendingContext({ site, postId: pageResult.postId });
      setPendingOriginalElementorJson(elementorJson);
      setPlan({
        summary: phase1.summary,
        changes: phase1.changes,
        modifiedElementorData: undefined,
      });
      setStep("done");
      notify.success(NOTIFY_CHECKLIST_READY_REVIEW_AND_CLICK_CREATE_);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setStep("idle");
      setPlanDialogOpen(false);
      notify.error(message);
    }
  }, [site, selectedPostData]);

  const handleCreatePlanAndUpdate = useCallback(async () => {
    if (!plan || !pendingContext || !pendingOriginalElementorJson || (plan.changes?.length ?? 0) === 0) {
      notify.error(NOTIFY_CHECKLIST_IS_EMPTY_OR_MISSING_PAGE_DATA);
      return;
    }
    notify.info(NOTIFY_CREATING_ELEMENTOR_PLAN_AND_UPDATING_PAG);
    const built = await buildLayoutFromChecklist(
      pendingOriginalElementorJson,
      plan.changes,
      plan.summary || "",
      { siteId: pendingContext.site.id }
    );
    if (!built) {
      notify.error(NOTIFY_FAILED_TO_BUILD_LAYOUT_FROM_CHECKLIST_TR);
      throw new Error("Failed to build layout from checklist");
    }
    try {
      await applyElementorOptimization(pendingContext.site, pendingContext.postId, JSON.stringify(built));
      notify.success(NOTIFY_PAGE_LAYOUT_UPDATED_SUCCESSFULLY);
      setPlan(null);
      setPendingContext(null);
      setPendingOriginalElementorJson(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      notify.error(message);
      throw e;
    }
  }, [plan, pendingContext, pendingOriginalElementorJson]);

  const isBusy = step !== "idle" && step !== "done";
  const showSteps = isBusy || step === "done";

  return (
    <>
      <div className="neo-pulse-panel-neon space-y-2 p-3 sm:p-4">
        <div className="text-base font-semibold text-primary">
          Elementor Page Optimizer
        </div>
        <div className="space-y-2">
          <UnifiedContentSelector
            theme="default"
            site={site}
            value={selectedLink}
            onValueChange={(newUrl) => {
              setSelectedLink(typeof newUrl === "string" ? newUrl : "");
              if (typeof newUrl !== "string" || newUrl !== selectedLink) {
                setSelectedPostData(null);
              }
            }}
            postType="page"
            onPostTypeChange={() => {}}
            disabled={disabled || isBusy}
            multiSelect={false}
            onPostDataChange={setSelectedPostData}
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              onClick={handleAnalyze}
              disabled={disabled || !selectedPostData?.id || isBusy}
              className="h-9 text-sm font-medium"
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  {step === "fetching" ? "Read page…" : step === "breakdown" ? "Analyze…" : "Checklist…"}
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Analyze
                </>
              )}
            </Button>
          </div>
          {showSteps && (
            <ul className="mt-2 space-y-1 rounded-md border border-primary/35 bg-black/25 p-2.5 text-xs shadow-none">
              {STEPS.map((s) => {
                const isCurrent = step === s.key;
                const isPast =
                  (step === "done" && (s.key === "fetching" || s.key === "breakdown" || s.key === "plan" || s.key === "done")) ||
                  (step === "plan" && (s.key === "fetching" || s.key === "breakdown")) ||
                  (step === "breakdown" && s.key === "fetching");
                return (
                  <li key={s.key} className="flex items-center gap-2">
                    {isCurrent ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                    ) : isPast ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0 text-foreground" />
                    )}
                    <span className={isCurrent ? "text-foreground font-medium" : isPast ? "text-muted-foreground" : "text-foreground"}>
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>
      </div>

      <ElementorOptimizationPlanDialog
        open={planDialogOpen}
        onOpenChange={(open) => {
          setPlanDialogOpen(open);
          if (!open) {
            setStep("idle");
            setPendingOriginalElementorJson(null);
          }
        }}
        plan={plan}
        onApprove={handleCreatePlanAndUpdate}
        phase={step as ElementorPlanPhase}
      />
    </>
  );
};
