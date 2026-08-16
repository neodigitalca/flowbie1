import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type PulseAssistSidebarResizeHandleProps = ComponentPropsWithoutRef<"div">;

export function PulseAssistSidebarResizeHandle({
  className,
  ...props
}: PulseAssistSidebarResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      className={cn("pulse-assist-panel-resize-handle", className)}
      {...props}
    />
  );
}
