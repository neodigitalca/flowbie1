import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, ListOrdered } from "lucide-react";
import type { OptimizationPlan } from "@/lib/elementor-optimizer";

export type ElementorPlanPhase = "idle" | "fetching" | "breakdown" | "plan" | "done";

interface ElementorOptimizationPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: OptimizationPlan | null;
  onApprove: () => void | Promise<void>;
  isApplying?: boolean;
  /** Current phase while generating (fetching → breakdown → plan → done). */
  phase?: ElementorPlanPhase;
}

export const ElementorOptimizationPlanDialog: React.FC<ElementorOptimizationPlanDialogProps> = ({
  open,
  onOpenChange,
  plan,
  onApprove,
  isApplying = false,
  phase = "idle",
}) => {
  const [localApplying, setLocalApplying] = useState(false);
  const applying = isApplying || localApplying;
  const isGenerating = phase === "fetching" || phase === "breakdown" || phase === "plan";

  const handleApprove = async () => {
    if (applying || !plan) return;
    setLocalApplying(true);
    try {
      await onApprove();
      onOpenChange(false);
    } finally {
      setLocalApplying(false);
    }
  };

  const canApprove = !!plan && !applying && (plan.changes?.length ?? 0) > 0;

  const phaseLabel =
    phase === "fetching"
      ? "Read page data…"
      : phase === "breakdown"
        ? "Analyzing layout…"
        : phase === "plan"
          ? "Suggesting checklist…"
          : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[700px] max-h-[85vh] flex flex-col bg-card border-border text-foreground"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5 text-primary" />
            Elementor optimization checklist
          </DialogTitle>
          <DialogDescription>
            {isGenerating
              ? "Reading page data, then suggesting a checklist. Review and confirm to create the plan and update the page."
              : "Review the suggested checklist. Click Create plan and update page to build the layout and apply it."}
          </DialogDescription>
        </DialogHeader>

        {isGenerating && phaseLabel && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            {phaseLabel}
          </p>
        )}

        {!plan && !isGenerating && (
          <p className="text-muted-foreground text-sm">No plan to display.</p>
        )}

        {plan && !isGenerating && (
          <ScrollArea className="flex-1 min-h-0 border rounded-md p-3">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-1">Summary</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {plan.summary?.trim() || "No summary was generated."}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Changes</h4>
                {plan.changes?.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {plan.changes.map((c, i) => (
                      <li key={i}>
                        <span className="font-medium text-foreground">{c.type}</span>: {c.description}
                        {c.elementId && <span className="text-xs ml-1">({c.elementId})</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No changes were listed.</p>
                )}
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={applying || isGenerating}>
            Cancel
          </Button>
          <Button type="button" onClick={handleApprove} disabled={!canApprove}>
            {applying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating plan and updating page…
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Create plan and update page
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
