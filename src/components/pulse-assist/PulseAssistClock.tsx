import { useEffect, useState } from "react";
import { formatEdmontonClock } from "@/lib/edmonton-time";
import { cn } from "@/lib/utils";

type PulseAssistClockProps = {
  className?: string;
};

export function PulseAssistClock({ className }: PulseAssistClockProps) {
  const [label, setLabel] = useState(() => formatEdmontonClock());

  useEffect(() => {
    setLabel(formatEdmontonClock());
    const id = window.setInterval(() => setLabel(formatEdmontonClock()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className={cn("flex min-w-0 items-center gap-2 text-base text-muted-foreground", className)}
      aria-live="off"
    >
      <span className="pulse-assist-clock__city shrink-0 text-muted-foreground">Edmonton</span>
      <span className="min-w-0 truncate font-medium tabular-nums text-foreground">{label}</span>
    </div>
  );
}
