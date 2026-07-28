import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FlowbieAppBrandProps {
  onClick: () => void;
  className?: string;
  /** default: top bar; compact: dense; footer: large wordmark (landing-style). */
  variant?: "default" | "compact" | "footer";
  /** Show deploy commit under the wordmark (top bar only). */
  showVersion?: boolean;
}

export function FlowbieAppBrand({
  onClick,
  className,
  variant = "default",
  showVersion = false,
}: FlowbieAppBrandProps) {
  const compact = variant === "compact";
  const footer = variant === "footer";
  /** Render/Vercel inject commit SHA at build time - proves which revision the static host is serving. */
  const deploySha = (import.meta.env.VITE_DEPLOY_GIT_SHA as string | undefined)?.trim() ?? "";
  const deployShort = deploySha.length >= 7 ? deploySha.slice(0, 7) : deploySha;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center rounded-md p-0 text-left transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        compact ? "gap-1.5" : footer ? "gap-3 md:gap-4" : "gap-2",
        className
      )}
      title="Dashboard (Properties)"
      aria-label="Go to Dashboard, Properties home"
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md bg-primary",
          compact ? "h-7 w-7" : footer ? "h-14 w-14 rounded-xl md:h-16 md:w-16" : "h-9 w-9 md:h-10 md:w-10"
        )}
      >
        <Sparkles
          className={cn(
            "text-primary-foreground",
            compact ? "h-3.5 w-3.5" : footer ? "h-8 w-8 md:h-9 md:w-9" : "h-4 w-4 md:h-5 md:w-5"
          )}
        />
      </span>
      <span className="flex min-w-0 flex-col items-start gap-0.5">
        <span
          className={cn(
            "whitespace-nowrap font-semibold tracking-tight text-foreground",
            compact ? "text-xs" : footer ? "text-3xl font-semibold tracking-tight md:text-4xl" : "text-sm md:text-base"
          )}
        >
          Flowbie
        </span>
        {showVersion && deployShort ? (
          <span
            className="font-mono text-base leading-none text-white"
            title={`Deploy commit ${deploySha}`}
          >
            {deployShort}
          </span>
        ) : null}
      </span>
    </button>
  );
}
