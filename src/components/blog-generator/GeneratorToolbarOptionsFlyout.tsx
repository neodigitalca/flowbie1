import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BULK_HEADER_TOOL_BTN } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import { cn } from "@/lib/utils";

export type GeneratorToolbarOptionsFlyoutProps = {
  children: ReactNode;
  label?: string;
  disabled?: boolean;
  className?: string;
};

export function GeneratorToolbarOptionsFlyout({
  children,
  label = "Options",
  disabled = false,
  className,
}: GeneratorToolbarOptionsFlyoutProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(BULK_HEADER_TOOL_BTN, "gap-1.5", className)}
          disabled={disabled}
          aria-label={label}
          title={label}
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(22rem,calc(100vw-2rem))] space-y-3 rounded-none border-border bg-zinc-900 p-3"
        align="start"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
