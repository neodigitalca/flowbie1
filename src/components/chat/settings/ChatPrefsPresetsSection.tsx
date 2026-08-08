import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHAT_BUILTIN_PRESETS } from "@/lib/chat-preferences-presets";
import type { ChatUserPreferences } from "@/lib/chat-preferences-types";

type Props = {
  draft: ChatUserPreferences;
  onApplyPreset: (id: string) => void;
  onSaveCustom: (name: string) => void;
  onDeleteSaved: (id: string) => void;
};

export function ChatPrefsPresetsSection({
  draft,
  onApplyPreset,
  onSaveCustom,
  onDeleteSaved,
}: Props): React.ReactElement {
  const [customName, setCustomName] = React.useState("");

  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold">Presets</h3>
      <div className="flex flex-wrap gap-2">
        {CHAT_BUILTIN_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            variant={draft.activePresetId === preset.id ? "default" : "outline"}
            className="h-9 text-base"
            onClick={() => onApplyPreset(preset.id)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      {draft.savedPresets.length > 0 ? (
        <div className="space-y-2">
          <p className="text-base text-muted-foreground">Saved presets</p>
          {draft.savedPresets.map((preset) => (
            <div key={preset.id} className="flex items-center gap-2">
              <Button
                type="button"
                variant={draft.activePresetId === preset.id ? "default" : "ghost"}
                className="h-9 flex-1 justify-start text-base"
                onClick={() => onApplyPreset(preset.id)}
              >
                {preset.name}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 text-base text-muted-foreground"
                onClick={() => onDeleteSaved(preset.id)}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex gap-2">
        <input
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Preset name"
          className={cn(
            "h-10 min-w-0 flex-1 rounded-md bg-zinc-900/50 px-3 text-base outline-none",
            "placeholder:text-muted-foreground",
          )}
        />
        <Button
          type="button"
          className="h-10 text-base"
          disabled={!customName.trim()}
          onClick={() => {
            onSaveCustom(customName.trim());
            setCustomName("");
          }}
        >
          Save current
        </Button>
      </div>
    </section>
  );
}
