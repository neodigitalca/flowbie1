import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type AgentRunsSidebarResizeHandleProps = ComponentPropsWithoutRef<"div">;

export function AgentRunsSidebarResizeHandle({ className, ...props }: AgentRunsSidebarResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      className={cn("agent-runs-panel-resize-handle", className)}
      {...props}
    />
  );
}
