import React from "react";
import { cn } from "@/lib/utils";

export type GbpPublishPipelineStepId = "condense" | "moneyPage" | "image" | "publish";

const STEPS: { id: GbpPublishPipelineStepId; label: string }[] = [
  { id: "condense", label: "Write post card" },
  { id: "moneyPage", label: "Set learn more link" },
  { id: "image", label: "Match site image" },
  { id: "publish", label: "Publish to GBP" },
];

interface GbpPostPublishPipelineProps {
  active: boolean;
  activeStepIndex: number;
  className?: string;
}

export const GbpPostPublishPipeline: React.FC<GbpPostPublishPipelineProps> = ({
  active,
  activeStepIndex,
  className,
}) => {
  if (!active && activeStepIndex <= 0) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-base font-medium text-foreground">Publish pipeline</p>
      <ul className="space-y-1">
        {STEPS.map((step, index) => {
          const done = !active && activeStepIndex >= STEPS.length ? true : index < activeStepIndex;
          const running = active && index === activeStepIndex;
          return (
            <li
              key={step.id}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1 text-base",
                running ? "bg-zinc-800 text-foreground" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  done ? "bg-primary" : running ? "bg-primary animate-pulse" : "bg-muted-foreground/40",
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1">{step.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
