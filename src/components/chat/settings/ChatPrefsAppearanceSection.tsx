import React from "react";
import { cn } from "@/lib/utils";
import { CHAT_ACCENT_OPTIONS } from "@/lib/chat-preferences-presets";
import type { ChatUserPreferences } from "@/lib/chat-preferences-types";

type Props = {
  draft: ChatUserPreferences;
  onChange: (patch: Partial<ChatUserPreferences["appearance"]>) => void;
};

function ToggleRow({
  label,
  checked,
  onChecked,
}: {
  label: string;
  checked: boolean;
  onChecked: (v: boolean) => void;
}): React.ReactElement {
  return (
    <label className="flex items-center justify-between gap-3 py-1 text-base">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChecked(e.target.checked)}
        className="h-4 w-4 accent-primary"
      />
    </label>
  );
}

export function ChatPrefsAppearanceSection({ draft, onChange }: Props): React.ReactElement {
  const { appearance } = draft;

  const setSidebar = (key: keyof typeof appearance.sidebarSections, value: boolean) => {
    onChange({
      sidebarSections: { ...appearance.sidebarSections, [key]: value },
    });
  };

  return (
    <section className="space-y-4">
      <h3 className="text-base font-semibold">Layout</h3>
      <div className="space-y-2">
        <p className="text-base text-muted-foreground">Accent</p>
        <div className="flex flex-wrap gap-2">
          {CHAT_ACCENT_OPTIONS.map((accent) => (
            <button
              key={accent.id}
              type="button"
              aria-label={accent.id}
              onClick={() => onChange({ accentPreset: accent.id })}
              className={cn(
                "h-8 w-8 rounded-full",
                accent.swatch,
                appearance.accentPreset === accent.id && "ring-2 ring-white ring-offset-2 ring-offset-background",
              )}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        {(["comfortable", "compact"] as const).map((density) => (
          <button
            key={density}
            type="button"
            onClick={() => onChange({ density })}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-base capitalize",
              appearance.density === density ? "bg-primary/20" : "bg-zinc-900/50 text-muted-foreground",
            )}
          >
            {density}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {(["default", "large"] as const).map((scale) => (
          <button
            key={scale}
            type="button"
            onClick={() => onChange({ fontScale: scale })}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-base capitalize",
              appearance.fontScale === scale ? "bg-primary/20" : "bg-zinc-900/50 text-muted-foreground",
            )}
          >
            {scale === "default" ? "Default" : "Large"}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        <p className="text-base text-muted-foreground">Sidebar sections</p>
        <ToggleRow label="Channels" checked={appearance.sidebarSections.channels} onChecked={(v) => setSidebar("channels", v)} />
        <ToggleRow label="DMs" checked={appearance.sidebarSections.dms} onChecked={(v) => setSidebar("dms", v)} />
        <ToggleRow label="Mentions" checked={appearance.sidebarSections.mentions} onChecked={(v) => setSidebar("mentions", v)} />
      </div>
    </section>
  );
}
