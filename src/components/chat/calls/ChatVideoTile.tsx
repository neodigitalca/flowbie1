import React, { useEffect, useRef } from "react";
import { CHAT_SURFACE_ELEVATED_CLASS, CHAT_TEXT_MUTED } from "@/components/chat/chat-theme";
import { cn } from "@/lib/utils";

export type ChatVideoTileProps = {
  stream: MediaStream | null;
  label: string;
  mirrored?: boolean;
  placeholder?: string;
  className?: string;
  minHeight?: string;
};

export function ChatVideoTile({
  stream,
  label,
  mirrored,
  placeholder = "No video",
  className,
  minHeight = "min-h-[120px]",
}: ChatVideoTileProps): React.ReactElement {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
  }, [stream]);

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden rounded-md",
        CHAT_SURFACE_ELEVATED_CLASS,
        minHeight,
        className,
      )}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={mirrored}
        className={mirrored ? "h-full w-full scale-x-[-1] object-cover" : "h-full w-full object-cover"}
      />
      {!stream ? (
        <div className={cn("absolute inset-0 flex items-center justify-center text-base", CHAT_TEXT_MUTED)}>
          {placeholder}
        </div>
      ) : null}
      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-base text-white">{label}</span>
    </div>
  );
}
