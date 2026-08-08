import type { LucideIcon } from "lucide-react";
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
  icon?: LucideIcon;
  /** Icon-only pill (label used for aria-label / title). */
  iconOnly?: boolean;
  onClick: () => void;
  className?: string;
};

export function WorkspacePill({
  label,
  active,
  disabled = false,
  square = false,
  icon: Icon,
  iconOnly = false,
  onClick,
  className,
}: WorkspacePillProps) {
  const blockInteraction = disabled;
  const nativeDisabled = disabled && !active;

  return (
    <button
      type="button"
      disabled={nativeDisabled}
      aria-disabled={blockInteraction || undefined}
      aria-pressed={active}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      onClick={() => {
        if (blockInteraction) return;
        onClick();
      }}
      className={cn(
        square ? WORKSPACE_PILL_SQUARE_BASE : WORKSPACE_PILL_BASE,
        iconOnly ? "h-8 w-8 min-w-0 shrink-0 px-0" : "h-8 min-w-[4.5rem]",
        active ? WORKSPACE_PILL_ACTIVE : WORKSPACE_PILL_INACTIVE,
        disabled && !active && "pointer-events-none opacity-50",
        disabled && active && "pointer-events-none",
        className,
      )}
    >
      {iconOnly && Icon ? (
        <Icon className="relative z-[1] h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <>
          {Icon ? <Icon className="relative z-[1] mr-1.5 h-4 w-4 shrink-0" aria-hidden /> : null}
          <span className="relative z-[1] block min-w-0 truncate">{label}</span>
        </>
      )}
    </button>
  );
}
