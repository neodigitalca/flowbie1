import type { AssistCardStep } from "@/lib/pulse-assist/types";
import { cn } from "@/lib/utils";

type PulseAssistThinkingCardProps = {
  title?: string;
  steps: AssistCardStep[];
  active?: boolean;
};

function stepIcon(status: AssistCardStep["status"]): string {
  if (status === "done") return "✓";
  if (status === "error") return "×";
  if (status === "running") return "◉";
  return "○";
}

export function PulseAssistThinkingCard({
  title = "Working on it…",
  steps,
  active = true,
}: PulseAssistThinkingCardProps) {
  return (
    <div className={cn("fcw-card fcw-card--workflow", active && "fcw-card--active")}>
      <div className="fcw-card__title">{title}</div>
      <ul className="fcw-card__steps">
        {steps.map((step, index) => (
          <li
            key={step.id || `${step.label}-${index}`}
            className={cn(
              "fcw-card__step",
              step.step_kind === "agent" && "fcw-card__step--agent",
              step.step_kind === "lead" && "fcw-card__step--lead",
              step.status === "running" && "fcw-card__step--running",
              step.status === "done" && "fcw-card__step--done",
              step.status === "error" && "fcw-card__step--error",
              step.status === "pending" && "fcw-card__step--pending",
            )}
          >
            <span className="fcw-card__step-icon" aria-hidden>
              {stepIcon(step.status)}
            </span>
            <span className="fcw-card__step-label">{step.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
