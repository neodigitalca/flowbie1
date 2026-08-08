import { FloBrandMark } from "@/components/manager/FloBrandMark";
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
  const markSize = compact ? 28 : footer ? 56 : 36;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center rounded-md p-0 text-left transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        compact ? "gap-2" : footer ? "gap-3 md:gap-4" : "gap-2.5",
        className
      )}
      title="Dashboard (Properties)"
      aria-label="Go to Dashboard, Properties home"
    >
      <FloBrandMark size={markSize} />
      <span className="flex min-w-0 flex-col items-start gap-0.5">
        <span
          className={cn(
            "whitespace-nowrap font-semibold tracking-tight text-foreground",
            compact ? "text-base" : footer ? "text-3xl font-semibold tracking-tight md:text-4xl" : "text-lg md:text-xl"
          )}
        >
          FLO
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
