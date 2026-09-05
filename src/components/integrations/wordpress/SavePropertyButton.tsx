import { useEffect, useRef, useState, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TASK_FORM_DIALOG_BUTTON_CLASS } from "@/components/manager/tasks/TaskFormLayout";

const CLICKED_MS = 500;

export function SavePropertyButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}): ReactElement {
  const [clicked, setClicked] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <Button
      type="button"
      aria-pressed={clicked}
      className={cn(
        "h-10 bg-[#77AA00] text-base font-semibold text-black shadow-none hover:bg-[#77AA00]/90",
        "active:bg-black active:text-[#77AA00]",
        clicked && "bg-black text-[#77AA00] hover:bg-black hover:text-[#77AA00]",
        TASK_FORM_DIALOG_BUTTON_CLASS,
        className,
      )}
      onClick={() => {
        setClicked(true);
        onClick();
        if (timerRef.current != null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setClicked(false), CLICKED_MS);
      }}
    >
      Save Property
    </Button>
  );
}
