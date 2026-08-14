import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { META_VISUAL_CONTROL_SURFACE_CLASS } from "@/components/ppc/meta/meta-ads-visual-settings-layout";
import { cn } from "@/lib/utils";

export type MetaAdsDarkSelectOption = {
  value: string;
  label: string;
};

export type MetaAdsDarkSelectProps = {
  value: string;
  options: MetaAdsDarkSelectOption[];
  disabled?: boolean;
  id?: string;
  className?: string;
  triggerClassName?: string;
  ariaLabel?: string;
  onChange: (value: string) => void;
};

const TRIGGER_BASE = cn(
  "h-8 border-0 px-2 text-base shadow-none focus:ring-offset-0",
  META_VISUAL_CONTROL_SURFACE_CLASS,
);

const CONTENT_CLASS = "rounded-none border-0 bg-zinc-800 text-base text-zinc-100";

const ITEM_CLASS =
  "rounded-none text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100 data-[highlighted]:bg-zinc-700 data-[highlighted]:text-zinc-100";

export function MetaAdsDarkSelect({
  value,
  options,
  disabled,
  id,
  className,
  triggerClassName,
  ariaLabel,
  onChange,
}: MetaAdsDarkSelectProps) {
  return (
    <Select value={value} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn(TRIGGER_BASE, triggerClassName, className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={CONTENT_CLASS}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className={ITEM_CLASS}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
