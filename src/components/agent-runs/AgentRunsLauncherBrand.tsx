import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

type AgentRunsLauncherBrandProps = {
  className?: string;
};

/** Black launcher tab: green agent icon + Agents label (mirrors Pulse Assist). */
export function AgentRunsLauncherBrand({ className }: AgentRunsLauncherBrandProps) {
  return (
    <span className={cn("agent-runs-launcher-brand", className)}>
      <Bot className="agent-runs-launcher-brand__icon" aria-hidden />
      <span className="agent-runs-launcher-brand__label">Agents</span>
    </span>
  );
}
