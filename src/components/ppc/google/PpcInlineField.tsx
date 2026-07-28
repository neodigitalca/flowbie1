import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PpcInlineField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-start gap-2 sm:items-center", className)}>
      <span className="w-[6.5rem] shrink-0 text-base text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
