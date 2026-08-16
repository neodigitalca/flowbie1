import { useEffect, useRef } from "react";
import { Send } from "lucide-react";
import type { AssistSubmode } from "@/lib/pulse-assist/types";
import { ADMIN_SUBMODE_LABELS } from "@/lib/pulse-assist/types";
import { cycleSubmode } from "@/lib/pulse-assist/storage";
import { NEO_PULSE_ASSIST_LABEL } from "@/components/pulse-assist/PulseAssistBrandTitle";
import { cn } from "@/lib/utils";

type PulseAssistComposerProps = {
  value: string;
  onChange: (value: string) => void;
  submode: AssistSubmode;
  onSubmodeChange: (submode: AssistSubmode) => void;
  onSend: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
};

export function PulseAssistComposer({
  value,
  onChange,
  submode,
  onSubmodeChange,
  onSend,
  disabled,
  autoFocus,
  placeholder = `Ask ${NEO_PULSE_ASSIST_LABEL}…`,
}: PulseAssistComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!autoFocus || disabled) return;
    textareaRef.current?.focus();
  }, [autoFocus, disabled]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        onSubmodeChange(cycleSubmode(submode));
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!disabled && value.trim()) onSend();
      }
    };
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [submode, onSubmodeChange, onSend, disabled, value]);

  return (
    <div className="fcw-composer">
      <button
        type="button"
        className="fcw-submode-pill"
        onClick={() => onSubmodeChange(cycleSubmode(submode))}
        aria-label={`Submode ${ADMIN_SUBMODE_LABELS[submode]}. Shift+Tab to cycle.`}
      >
        {ADMIN_SUBMODE_LABELS[submode]}
      </button>
      <textarea
        ref={textareaRef}
        className="fcw-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        disabled={disabled}
      />
      <button
        type="button"
        className={cn("fcw-send-btn", disabled && "fcw-send-btn--disabled")}
        onClick={onSend}
        disabled={disabled || !value.trim()}
        aria-label="Send"
      >
        <Send className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}
