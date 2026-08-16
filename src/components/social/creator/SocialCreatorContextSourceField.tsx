import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { PPC_DETAIL_INPUT_CLASS } from "@/components/ppc/google/google-ads-row-details-styles";
import type { MetaAdContextSource } from "@/lib/social/social-creator-types";
import { cn } from "@/lib/utils";

const META_CONTEXT_OPTIONS: Array<{
  value: MetaAdContextSource;
  label: string;
  hint: string;
}> = [
  {
    value: "neo-pulse_app",
    label: "NEO Pulse app",
    hint: "Built-in marketing context",
  },
  {
    value: "custom",
    label: "Custom URL",
    hint: "Research any page with DataForSEO",
  },
];

export type SocialCreatorContextSourceFieldProps = {
  contextSource: MetaAdContextSource;
  contextUrl?: string;
  disabled?: boolean;
  onContextSourceChange?: (source: MetaAdContextSource) => void;
  onContextUrlChange?: (url: string) => void;
};

export function SocialCreatorContextSourceField({
  contextSource,
  contextUrl,
  disabled,
  onContextSourceChange,
  onContextUrlChange,
}: SocialCreatorContextSourceFieldProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isCustom = contextSource === "custom";

  const handleOpenChange = (nextOpen: boolean) => {
    if (disabled) return;
    setOpen(nextOpen);
  };

  const closePickerIfBlurred = () => {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (anchorRef.current?.contains(active)) return;
      if (contentRef.current?.contains(active)) return;
      setOpen(false);
    }, 0);
  };

  const pickSource = (source: MetaAdContextSource) => {
    onContextSourceChange?.(source);
    setOpen(false);
    if (source === "custom") {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const openMenu = () => {
    if (disabled) return;
    setOpen(true);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Anchor asChild>
        <div
          ref={anchorRef}
          data-meta-context-picker
          className={cn(
            PPC_DETAIL_INPUT_CLASS,
            "flex h-8 w-full min-w-0 items-stretch overflow-hidden p-0",
            disabled && "opacity-50",
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            ref={inputRef}
            value={isCustom ? (contextUrl ?? "") : "NEO Pulse app"}
            readOnly={!isCustom || disabled}
            disabled={disabled}
            placeholder={isCustom ? "Context URL" : undefined}
            className={cn(
              "h-full min-w-0 flex-1 border-0 bg-transparent px-2 text-base shadow-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0",
              isCustom ? "text-foreground" : "cursor-default text-muted-foreground",
            )}
            aria-label={isCustom ? "Context URL" : "Context source"}
            aria-expanded={open}
            aria-haspopup="listbox"
            onClick={(e) => {
              e.stopPropagation();
              if (!isCustom && !disabled) openMenu();
            }}
            onFocus={() => {
              if (!isCustom && !disabled) openMenu();
            }}
            onKeyDown={(e) => e.stopPropagation()}
            onBlur={closePickerIfBlurred}
            onChange={(e) => {
              if (!isCustom) return;
              onContextUrlChange?.(e.target.value);
            }}
          />
          <button
            type="button"
            disabled={disabled}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-foreground hover:bg-white/10 disabled:opacity-50"
            aria-label={open ? "Close context options" : "Open context options"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              if (open) {
                setOpen(false);
                return;
              }
              setOpen(true);
              if (isCustom) {
                inputRef.current?.focus();
              }
            }}
          >
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
              aria-hidden
            />
          </button>
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverContent
        ref={contentRef}
        align="start"
        sideOffset={4}
        className="w-[var(--radix-popover-trigger-width)] max-w-[var(--radix-popover-trigger-width)] rounded-none border-0 bg-zinc-900 p-1.5 shadow-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (anchorRef.current?.contains(e.target as Node)) {
            e.preventDefault();
          }
        }}
      >
        <div className="space-y-0.5" role="listbox" aria-label="Context source">
          {META_CONTEXT_OPTIONS.map((option) => {
            const selected = contextSource === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                className={cn(
                  "flex w-full min-w-0 flex-col rounded-none px-2 py-2 text-left hover:bg-black",
                  selected ? "bg-black text-white" : "text-foreground",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  pickSource(option.value);
                }}
              >
                <span className="text-base">{option.label}</span>
                <span className="text-base text-muted-foreground">{option.hint}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
