import { type ReactElement } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  getLocationOptions,
  isServiceCountry,
  regionBelongsToCountry,
  SERVICE_COUNTRIES,
  type ServiceCountry,
} from "@/lib/keyword-location-utils";
import {
  TASK_FORM_SELECT_CONTENT_CLASS,
  TASK_FORM_SELECT_ITEM_CLASS,
  TASK_FORM_SELECT_TRIGGER_CLASS,
} from "@/components/manager/tasks/TaskFormLayout";

function regionPlaceholder(country: string): string {
  if (country === "United States") return "State";
  if (country === "Canada") return "Province";
  return "State or province";
}

export function ProfileLocationSelect({
  placeholder,
  value,
  options,
  onChange,
  disabled = false,
  chrome,
}: {
  placeholder: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  chrome: "dark" | "light";
}): ReactElement {
  const listed = options.includes(value) || !value ? options : [value, ...options];
  const dark = chrome === "dark";
  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        aria-label={placeholder}
        className={cn(
          dark
            ? TASK_FORM_SELECT_TRIGGER_CLASS
            : "h-10 min-h-10 rounded-none border-0 bg-black p-0 text-base text-foreground shadow-none focus:ring-2 focus:ring-primary/55",
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={dark ? TASK_FORM_SELECT_CONTENT_CLASS : "rounded-none border-0 bg-black text-white"}>
        {listed.map((opt) => (
          <SelectItem
            key={opt}
            value={opt}
            className={dark ? TASK_FORM_SELECT_ITEM_CLASS : "text-base text-white focus:bg-[#09090B] focus:text-white"}
          >
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function nextStateForCountry(state: string, country: string): string {
  if (!isServiceCountry(country)) return "";
  return regionBelongsToCountry(state, country) ? state : "";
}

export function serviceRegionOptions(country: string): string[] {
  if (!isServiceCountry(country)) return [];
  return getLocationOptions(country as ServiceCountry);
}

export const SERVICE_COUNTRY_OPTIONS = [...SERVICE_COUNTRIES];
export { regionPlaceholder };
