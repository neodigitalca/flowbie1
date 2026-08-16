import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type AgentRunsGroupFolderProps = {
  label: string;
  count: number;
  activeCount?: number;
  open: boolean;
  depth: 0 | 1;
  onToggle: () => void;
};

export function AgentRunsGroupFolder({
  label,
  count,
  activeCount = 0,
  open,
  depth,
  onToggle,
}: AgentRunsGroupFolderProps) {
  const countLabel = activeCount > 0 ? `${label} · ${count} · ${activeCount} active` : `${label} · ${count}`;

  return (
    <button
      type="button"
      className={cn(
        "agent-runs-folder",
        depth === 1 && "agent-runs-folder--bucket",
        open && "agent-runs-folder--open",
      )}
      aria-expanded={open}
      onClick={onToggle}
    >
      {open ? <ChevronDown className="agent-runs-folder__chevron" aria-hidden /> : <ChevronRight className="agent-runs-folder__chevron" aria-hidden />}
      <span className="agent-runs-folder__label">{countLabel}</span>
    </button>
  );
}
