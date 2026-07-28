import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { PPC_DETAIL_INPUT_CLASS } from "@/components/ppc/google/google-ads-row-details-styles";
import type { PpcWpPageContext } from "@/lib/ppc/google-ads-types";
import { cn } from "@/lib/utils";

export type GoogleAdsLandingPageFieldProps = {
  value: string;
  wpPages: PpcWpPageContext[];
  wpPagesLoading?: boolean;
  disabled?: boolean;
  onChange: (url: string) => void;
  onOpen?: () => void;
};

export function GoogleAdsLandingPageField({
  value,
  wpPages,
  wpPagesLoading = false,
  disabled = false,
  onChange,
  onOpen,
}: GoogleAdsLandingPageFieldProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const query = search.trim().toLowerCase();

  const selectedPage = useMemo(
    () => wpPages.find((page) => page.url === value),
    [value, wpPages],
  );

  const displayValue = open ? search : selectedPage?.title || value;

  const openPicker = () => {
    if (disabled) return;
    onOpen?.();
    setSearch("");
    setOpen(true);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (disabled) return;
    if (nextOpen) {
      onOpen?.();
      setSearch("");
    }
    setOpen(nextOpen);
  };

  const closePickerIfBlurred = () => {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (anchorRef.current?.contains(active)) return;
      if (contentRef.current?.contains(active)) return;
      setOpen(false);
      setSearch("");
    }, 0);
  };

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const filteredPages = useMemo(() => {
    if (!query) return wpPages;
    return wpPages.filter((page) => {
      const haystack = `${page.title} ${page.url}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [query, wpPages]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Anchor asChild>
        <div
          ref={anchorRef}
          data-landing-page-picker
          className={cn(
            PPC_DETAIL_INPUT_CLASS,
            "flex h-9 w-full min-w-0 items-stretch overflow-hidden p-0",
            disabled && "opacity-50",
          )}
          onMouseDown={(e) => {
            e.stopPropagation();
            if ((e.target as HTMLElement).closest("button")) return;
            openPicker();
          }}
        >
          <input
            ref={inputRef}
            value={displayValue}
            readOnly={!open}
            disabled={disabled}
            placeholder="Landing page"
            className="h-full min-w-0 flex-1 border-0 bg-transparent px-2 text-base text-zinc-100 shadow-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0"
            aria-label="Landing page"
            aria-expanded={open}
            aria-haspopup="listbox"
            onFocus={openPicker}
            onClick={(e) => {
              e.stopPropagation();
              if (open) {
                setSearch("");
              } else {
                openPicker();
              }
            }}
            onKeyDown={(e) => e.stopPropagation()}
            onBlur={closePickerIfBlurred}
            onChange={(e) => {
              setSearch(e.target.value);
              openPicker();
            }}
          />
          <button
            type="button"
            disabled={disabled}
            className="inline-flex h-9 w-8 shrink-0 items-center justify-center text-zinc-100 hover:bg-white/10 disabled:opacity-50"
            aria-label={open ? "Close landing pages" : "Open landing pages"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              if (open) {
                setOpen(false);
                setSearch("");
                return;
              }
              onOpen?.();
              setSearch("");
              setOpen(true);
              inputRef.current?.focus();
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
        className="w-[var(--radix-popover-trigger-width)] max-w-[var(--radix-popover-trigger-width)] rounded-none border-0 bg-zinc-900 p-2 shadow-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (anchorRef.current?.contains(e.target as Node)) {
            e.preventDefault();
          }
        }}
      >
        <div className="max-h-56 space-y-0.5 overflow-y-auto" role="listbox" aria-label="Landing pages">
          {wpPagesLoading ? (
            <p className="px-2 py-1.5 text-base text-muted-foreground">Loading pages…</p>
          ) : filteredPages.length === 0 ? (
            <p className="px-2 py-1.5 text-base text-muted-foreground">
              {wpPages.length === 0 ? "No WordPress pages loaded." : "No pages match your search."}
            </p>
          ) : (
            filteredPages.map((page) => {
              const selected = value === page.url;
              return (
                <button
                  key={page.url}
                  type="button"
                  className={cn(
                    "flex w-full min-w-0 items-center rounded-none px-2 py-1.5 text-left text-base hover:bg-black",
                    selected ? "text-white" : "text-foreground",
                  )}
                  title={page.url}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(page.url);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <span className="min-w-0 truncate">{page.title}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
