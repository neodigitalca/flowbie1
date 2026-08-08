import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FALLBACK_JOB_TITLE_PRESETS, type JobTitlePreset } from "@/lib/teams-types";

const CUSTOM_JOB_TITLE = "__custom__";

export type TeamJobTitleFieldProps = {
  value: string;
  onChange: (value: string) => void;
  presets: JobTitlePreset[];
  disabled?: boolean;
  inputClass: string;
};

export function TeamJobTitleField({ value, onChange, presets, disabled, inputClass }: TeamJobTitleFieldProps) {
  const presetTitles = useMemo(() => {
    const titles = presets.map((p) => p.title);
    return titles.length > 0 ? titles : [...FALLBACK_JOB_TITLE_PRESETS];
  }, [presets]);

  const [customMode, setCustomMode] = useState(() => value !== "" && !presetTitles.includes(value));

  useEffect(() => {
    setCustomMode(value !== "" && !presetTitles.includes(value));
  }, [value, presetTitles]);

  const selectValue = customMode ? CUSTOM_JOB_TITLE : presetTitles.includes(value) ? value : presetTitles[0];

  return (
    <div className="space-y-2">
      <Select
        value={selectValue}
        onValueChange={(next) => {
          if (next === CUSTOM_JOB_TITLE) {
            setCustomMode(true);
            if (presetTitles.includes(value)) onChange("");
            return;
          }
          setCustomMode(false);
          onChange(next);
        }}
        disabled={disabled}
      >
        <SelectTrigger className={inputClass}>
          <SelectValue aria-label="Job title" />
        </SelectTrigger>
        <SelectContent>
          {presetTitles.map((title) => (
            <SelectItem key={title} value={title}>
              {title}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM_JOB_TITLE}>Custom</SelectItem>
        </SelectContent>
      </Select>
      {customMode ? (
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Custom job title"
          placeholder="Custom job title"
          className={inputClass}
          disabled={disabled}
        />
      ) : null}
    </div>
  );
}
