import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type PulseAssistLauncherBrandProps = {
  className?: string;
};

/** Black launcher tab: green AI spark + Assist label. */
export function PulseAssistLauncherBrand({ className }: PulseAssistLauncherBrandProps) {
  return (
    <span className={cn("pulse-assist-launcher-brand", className)}>
      <Sparkles className="pulse-assist-launcher-brand__spark" aria-hidden />
      <span className="pulse-assist-launcher-brand__label">Assist</span>
    </span>
  );
}
