import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HexColorPicker } from "react-colorful";
import { cn } from "@/lib/utils";
import {
  META_VISUAL_COLOR_CELL_GRID_CLASS,
  META_VISUAL_CONTROL_SURFACE_CLASS,
  META_VISUAL_FIELD_COL,
  META_VISUAL_LABEL_COL,
  META_VISUAL_TOOL_LABEL_CLASS,
} from "@/components/ppc/meta/meta-ads-visual-settings-layout";

type ImageColorInputFieldProps = {
  label: string;
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  layout?: "stacked" | "inline" | "cell" | "input";
};

export function ImageColorInputField({
  label,
  value,
  onChange,
  disabled,
  layout = "stacked",
}: ImageColorInputFieldProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const isHexColor = (hex: string) => /^\s*#?([0-9a-fA-F]{3}([0-9a-fA-F]{3})?)\s*$/.test(hex.trim());

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleColorChange = useCallback(
    (newColor: string) => {
      onChange(newColor);
      setInputValue(newColor);
    },
    [onChange],
  );

  const handleInputBlur = useCallback(() => {
    let newColor = inputValue.trim();
    if (newColor.length > 0 && !newColor.startsWith("#")) {
      newColor = `#${newColor}`;
    }
    if (isHexColor(newColor) && (newColor.length === 4 || newColor.length === 7)) {
      const normalizedColor = newColor.toLowerCase();
      onChange(normalizedColor);
      setInputValue(normalizedColor);
    } else {
      setInputValue(value || "");
    }
  }, [inputValue, onChange, value]);

  const displayValue = value || "#000000";
  const displayText = value || "#000000";

  const picker = (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-8 min-w-0 flex-1 justify-start rounded-none border-0 px-2 text-left text-base font-normal tabular-nums",
            META_VISUAL_CONTROL_SURFACE_CLASS,
          )}
          disabled={disabled}
        >
          <span className="truncate">{displayText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement;
          if (contentRef.current?.contains(target)) {
            e.preventDefault();
            return;
          }
          const reactColorfulElement = document.querySelector(".react-colorful");
          if (reactColorfulElement?.contains(target)) {
            e.preventDefault();
          }
        }}
      >
        <div
          ref={contentRef}
          className="flex flex-col gap-4 p-4"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div onPointerDown={(e) => e.stopPropagation()}>
            <HexColorPicker color={displayValue} onChange={handleColorChange} />
          </div>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleInputBlur}
            placeholder="#RRGGBB or #RGB"
            className={cn("h-8 text-center font-mono text-base")}
          />
        </div>
      </PopoverContent>
    </Popover>
  );

  if (layout === "input") {
    return <div className="min-w-0">{picker}</div>;
  }

  if (layout === "cell") {
    return (
      <div className={META_VISUAL_COLOR_CELL_GRID_CLASS}>
        <span className={META_VISUAL_TOOL_LABEL_CLASS}>{label}</span>
        {picker}
      </div>
    );
  }

  if (layout === "inline") {
    return (
      <div className="flex items-center gap-2">
        <span className={META_VISUAL_LABEL_COL}>{label}</span>
        <div className={META_VISUAL_FIELD_COL}>{picker}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="text-base text-foreground">{label}</span>
      {picker}
    </div>
  );
}
