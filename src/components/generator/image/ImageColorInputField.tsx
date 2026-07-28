import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HexColorPicker } from "react-colorful";
import { cn } from "@/lib/utils";

type ImageColorInputFieldProps = {
  label: string;
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
};

export function ImageColorInputField({ label, value, onChange, disabled }: ImageColorInputFieldProps) {
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
  const displayText = value || "Click to pick color";

  return (
    <div className="space-y-2">
      <Label className="text-base text-foreground">{label}</Label>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-full justify-start rounded-none bg-zinc-900 px-2.5 text-left text-base font-normal hover:bg-zinc-800"
            disabled={disabled}
          >
            <div className="flex w-full items-center gap-2">
              <div className="h-4 w-4 shrink-0 rounded-sm" style={{ backgroundColor: displayValue }} />
              <span className="truncate text-muted-foreground">{displayText}</span>
            </div>
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
    </div>
  );
}
