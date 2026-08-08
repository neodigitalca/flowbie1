import { cn } from "@/lib/utils";

export interface FloBrandMarkProps {
  className?: string;
  /** Pixel width and height of the mark. */
  size?: number;
}

/** Circle emblem: triple stacked wave + three scattered sparks (Neo primary green). */
export function FloBrandMark({ className, size = 40 }: FloBrandMarkProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cn("shrink-0 text-primary", className)}
      aria-hidden
    >
      <circle cx="24" cy="24" r="19" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M9 17.5 C13.5 13.5, 18.5 13.5, 24 17.5 S34.5 21.5, 39 17.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
      />
      <path
        d="M9 24 C13.5 20, 18.5 20, 24 24 S34.5 28, 39 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
      />
      <path
        d="M9 30.5 C13.5 26.5, 18.5 26.5, 24 30.5 S34.5 34.5, 39 30.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
      />
      <g transform="translate(34.5 5.5) scale(0.38)">
        <FloSpark />
      </g>
      <g transform="translate(3 21) scale(0.32)">
        <FloSpark />
      </g>
      <g transform="translate(37 36) scale(0.34)">
        <FloSpark />
      </g>
    </svg>
  );
}

function FloSpark() {
  return (
    <path
      d="M12 1.5 L13.8 8.2 L20.5 10 L13.8 11.8 L12 18.5 L10.2 11.8 L3.5 10 L10.2 8.2 Z"
      fill="currentColor"
    />
  );
}
