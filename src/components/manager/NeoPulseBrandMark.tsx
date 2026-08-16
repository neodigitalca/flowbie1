import { cn } from "@/lib/utils";
import { NEO_PULSE_BRAND_LOCKUP_SRC } from "@/lib/neo-pulse-branding-assets";

export interface NeoPulseBrandMarkProps {
  className?: string;
  /** Pixel height; width scales from cropped mark aspect ratio. */
  size?: number;
}

const MARK_ASPECT = 330 / 186;

/** NEO Pulse icon mark (waves + NEO) cropped from the brand lockup. */
export function NeoPulseBrandMark({ className, size = 40 }: NeoPulseBrandMarkProps) {
  const height = size;
  const width = Math.round(size * MARK_ASPECT);

  return (
    <span
      className={cn("relative inline-block shrink-0 overflow-hidden", className)}
      style={{ width, height }}
      aria-hidden
    >
      <img
        src={NEO_PULSE_BRAND_LOCKUP_SRC}
        alt=""
        className="absolute left-0 top-0 max-w-none"
        style={{ height, width: Math.round(height * (822.51 / 186.39)) }}
      />
    </span>
  );
}
