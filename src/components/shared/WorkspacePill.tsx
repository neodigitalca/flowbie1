import {
  WORKSPACE_PILL_ACTIVE,
  WORKSPACE_PILL_BASE,
  WORKSPACE_PILL_INACTIVE,
  WORKSPACE_PILL_SQUARE_BASE,
} from "@/components/shared/workspace-pill-styles";
import { cn } from "@/lib/utils";

export type WorkspacePillProps = {
  label: string;
  active: boolean;
  disabled?: boolean;
  /** Square corners (Content Optimizer chrome). */
  square?: boolean;
  onClick: () => void;
};

export function WorkspacePill({ label, active, disabled = false, square = false, onClick }: WorkspacePillProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        square ? WORKSPACE_PILL_SQUARE_BASE : WORKSPACE_PILL_BASE,
        "h-8 min-w-[4.5rem]",
        active ? WORKSPACE_PILL_ACTIVE : WORKSPACE_PILL_INACTIVE,
        disabled && "pointer-events-none opacity-50",
      )}
    >
      {label}
    </button>
  );
}
