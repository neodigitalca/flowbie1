import React, { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useChatPreferences } from "@/hooks/use-chat-preferences";
import { CHAT_TIMEZONE_OPTIONS } from "@/lib/chat-preferences-presets";
import { mergeChatPreferences } from "@/lib/chat-preferences-types";
import { uploadChatAvatar } from "@/lib/chat-preferences-api";
import { useTeam } from "@/contexts/TeamContext";
import { ChatPrefsPresetsSection } from "@/components/chat/settings/ChatPrefsPresetsSection";
import { ChatPrefsZoneThemesSection } from "@/components/chat/settings/ChatPrefsZoneThemesSection";
import { ChatPrefsAppearanceSection } from "@/components/chat/settings/ChatPrefsAppearanceSection";
import { ChatPrefsNotificationsSection } from "@/components/chat/settings/ChatPrefsNotificationsSection";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ChatPersonalizationModal({ open, onOpenChange }: Props): React.ReactElement {
  const { activeTeam } = useTeam();
  const teamId = activeTeam?.id ?? null;
  const { draft, setDraft, applyPreset, savePrefs, saveCustomPreset, deleteSavedPreset, resetDraft } =
    useChatPreferences();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const updateDraft = (patch: Parameters<typeof mergeChatPreferences>[1]) => {
    setDraft((current) => mergeChatPreferences(current, patch));
  };

  const handleSave = async () => {
    if (!teamId) return;
    setSaving(true);
    try {
      await savePrefs();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!teamId) return;
    setUploading(true);
    try {
      const result = await uploadChatAvatar(teamId, file);
      if (result.ok && result.avatarUrl) {
        updateDraft({ profile: { avatarUrl: result.avatarUrl } });
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetDraft();
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[min(88vh,900px)] w-[min(960px,92vw)] max-w-[min(960px,92vw)] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle className="text-base">Personalization</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-8">
              <ChatPrefsPresetsSection
                draft={draft}
                onApplyPreset={applyPreset}
                onSaveCustom={(name) => void saveCustomPreset(name)}
                onDeleteSaved={(id) => void deleteSavedPreset(id)}
              />
              <section className="space-y-3">
                <h3 className="text-base font-semibold">Profile</h3>
                <div className="flex items-center gap-3">
                  {draft.profile.avatarUrl ? (
                    <img src={draft.profile.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900/50 text-base font-semibold">
                      {(draft.profile.displayName || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleAvatarUpload(file);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 text-base"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                    >
                      Upload avatar
                    </Button>
                  </div>
                </div>
                <label className="block space-y-1">
                  <span className="text-base text-muted-foreground">Display name</span>
                  <input
                    value={draft.profile.displayName}
                    onChange={(e) => updateDraft({ profile: { displayName: e.target.value } })}
                    className="h-10 w-full rounded-md bg-zinc-900/50 px-3 text-base outline-none"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-base text-muted-foreground">Status</span>
                  <input
                    value={draft.profile.statusText}
                    onChange={(e) => updateDraft({ profile: { statusText: e.target.value } })}
                    className="h-10 w-full rounded-md bg-zinc-900/50 px-3 text-base outline-none"
                    placeholder="What are you working on?"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-base text-muted-foreground">Timezone</span>
                  <select
                    value={draft.profile.timezone}
                    onChange={(e) => updateDraft({ profile: { timezone: e.target.value } })}
                    className="h-10 w-full rounded-md bg-zinc-900/50 px-3 text-base outline-none"
                  >
                    {CHAT_TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-base text-muted-foreground">Avatar URL</span>
                  <input
                    value={draft.profile.avatarUrl ?? ""}
                    onChange={(e) => updateDraft({ profile: { avatarUrl: e.target.value.trim() || null } })}
                    className="h-10 w-full rounded-md bg-zinc-900/50 px-3 text-base outline-none"
                  />
                </label>
              </section>
            </div>
            <div className="space-y-8">
              <ChatPrefsZoneThemesSection draft={draft} onChange={(appearance) => updateDraft({ appearance })} />
              <ChatPrefsAppearanceSection draft={draft} onChange={(appearance) => updateDraft({ appearance })} />
              <ChatPrefsNotificationsSection
                draft={draft}
                onChangeNotifications={(notifications) => updateDraft({ notifications })}
                onChangeBehavior={(behavior) => updateDraft({ behavior })}
              />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2 px-6 pb-6 pt-4">
          <Button type="button" variant="ghost" className="h-10 flex-1 text-base" onClick={() => resetDraft()}>
            Reset
          </Button>
          <Button type="button" className="h-10 flex-1 text-base" disabled={saving} onClick={() => void handleSave()}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
