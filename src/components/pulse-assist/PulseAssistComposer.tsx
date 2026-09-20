import { useEffect, useRef } from "react";
import { Send } from "lucide-react";
import type { AssistSubmode, PageContentMode } from "@/lib/pulse-assist/types";
import { ADMIN_SUBMODE_LABELS, PAGE_CONTENT_MODE_LABELS } from "@/lib/pulse-assist/types";
import { cycleSubmode, togglePageContentMode } from "@/lib/pulse-assist/storage";
import { NEO_PULSE_ASSIST_LABEL } from "@/components/pulse-assist/PulseAssistBrandTitle";
import { cn } from "@/lib/utils";

type PulseAssistComposerProps = {
  value: string;
  onChange: (value: string) => void;
  submode: AssistSubmode;
  onSubmodeChange: (submode: AssistSubmode) => void;
  pageContentMode: PageContentMode;
  onPageContentModeChange: (mode: PageContentMode) => void;
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
  pageContentMode,
  onPageContentModeChange,
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
      <div className="fcw-composer-pills">
        <button
          type="button"
          className="fcw-submode-pill"
          onClick={() => onSubmodeChange(cycleSubmode(submode))}
          aria-label={`Submode ${ADMIN_SUBMODE_LABELS[submode]}. Shift+Tab to cycle.`}
        >
          {ADMIN_SUBMODE_LABELS[submode]}
        </button>
        <button
          type="button"
          className={cn(
            "fcw-submode-pill fcw-page-content-pill",
            pageContentMode === "elementor_widgets" && "fcw-page-content-pill--elementor",
          )}
          onClick={() => onPageContentModeChange(togglePageContentMode(pageContentMode))}
          aria-label={`Page content ${PAGE_CONTENT_MODE_LABELS[pageContentMode]}. Click to toggle.`}
        >
          {PAGE_CONTENT_MODE_LABELS[pageContentMode]}
        </button>
      </div>
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
