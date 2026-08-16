import { cn } from "@/lib/utils";
import { NEO_PULSE_BRAND_LOCKUP_SRC } from "@/lib/neo-pulse-branding-assets";

export interface NeoPulseAppBrandProps {
  onClick: () => void;
  className?: string;
  /** default: top bar; compact: dense top bar; footer: large lockup. */
  variant?: "default" | "compact" | "footer";
  /** Show deploy commit under the lockup (top bar only). */
  showVersion?: boolean;
}

const LOCKUP_ASPECT = 822.51 / 186.39;

export function NeoPulseAppBrand({
  onClick,
  className,
  variant = "default",
  showVersion = false,
}: NeoPulseAppBrandProps) {
  const compact = variant === "compact";
  const footer = variant === "footer";
  const deploySha = (import.meta.env.VITE_DEPLOY_GIT_SHA as string | undefined)?.trim() ?? "";
  const deployShort = deploySha.length >= 7 ? deploySha.slice(0, 7) : deploySha;
  const lockupHeight = compact ? 28 : footer ? 56 : 36;
  const lockupWidth = Math.round(lockupHeight * LOCKUP_ASPECT);

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
      <img
        src={NEO_PULSE_BRAND_LOCKUP_SRC}
        alt="NEO Pulse"
        width={lockupWidth}
        height={lockupHeight}
        className="block shrink-0"
        style={{ width: lockupWidth, height: lockupHeight }}
      />
      {showVersion && deployShort ? (
        <span
          className="font-mono text-base leading-none text-white"
          title={`Deploy commit ${deploySha}`}
        >
          {deployShort}
        </span>
      ) : null}
    </button>
  );
}
