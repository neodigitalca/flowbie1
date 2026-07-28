import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { googleAdsCharCount, googleAdsCharCountOver } from "@/lib/ppc/google-ads-field-limits";

export function GoogleAdsCharCount({
  value,
  max,
  className,
}: {
  value: string;
  max: number;
  className?: string;
}) {
  const count = googleAdsCharCount(value);
  const over = googleAdsCharCountOver(value, max);

  return (
    <span
      className={cn(
        "shrink-0 text-base tabular-nums",
        over ? "text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      {count}/{max}
    </span>
  );
}

export function GoogleAdsCountedInputShell({
  children,
  value,
  max,
}: {
  children: ReactNode;
  value: string;
  max: number;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      {children}
      <GoogleAdsCharCount
        value={value}
        max={max}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
      />
    </div>
  );
}
