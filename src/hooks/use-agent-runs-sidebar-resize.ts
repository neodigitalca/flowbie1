import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  clampAgentRunsSidebarWidth,
  readAgentRunsSidebarWidth,
  writeAgentRunsSidebarWidth,
} from "@/lib/agent-runs/storage";

const MOBILE_QUERY = "(max-width: 767px)";

type DragState = {
  startX: number;
  startWidth: number;
};

/** Left sidebar: drag handle on right edge; width grows when pointer moves right. */
export function useAgentRunsSidebarResize(enabled: boolean) {
  const [width, setWidth] = useState(() => readAgentRunsSidebarWidth());
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_QUERY).matches : false,
  );
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const onResize = () => setWidth((current) => clampAgentRunsSidebarWidth(current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ew-resize";
    return () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isResizing]);

  const finishResize = useCallback((nextWidth: number) => {
    const clamped = clampAgentRunsSidebarWidth(nextWidth);
    setWidth(clamped);
    writeAgentRunsSidebarWidth(clamped);
    setIsResizing(false);
    dragRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || isMobile || event.button !== 0) return;
      event.preventDefault();
      dragRef.current = { startX: event.clientX, startWidth: width };
      setIsResizing(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [enabled, isMobile, width],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = event.clientX - drag.startX;
      finishResize(drag.startWidth + delta);
    },
    [finishResize],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      const drag = dragRef.current;
      const delta = event.clientX - drag.startX;
      finishResize(drag.startWidth + delta);
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    },
    [finishResize],
  );

  return {
    width,
    isResizing,
    isMobile,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
    },
  };
}
