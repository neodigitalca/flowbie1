import { clampNoiseCancellationStrength } from "@/lib/call-audio-constraints";

export type ChatThemeId = "light" | "dark" | "midnight" | "high-contrast" | "brand";
export type ChatAccentPreset = "brand" | "blue" | "violet" | "rose" | "amber";
export type ChatDensity = "comfortable" | "compact";
export type ChatFontScale = "default" | "large";
export type ChatSoundPreset = "subtle" | "classic" | "none";
export type ChatBuiltinPresetId = "minimal" | "balanced" | "all" | "focus";

export type ChatSidebarSections = {
  channels: boolean;
  dms: boolean;
  mentions: boolean;
  alerts: boolean;
};

export type ChatZoneThemes = {
  left: ChatThemeId;
  main: ChatThemeId;
  right: ChatThemeId;
};

export type ChatProfilePrefs = {
  displayName: string;
  avatarUrl: string | null;
  statusText: string;
  timezone: string;
};

export type ChatAppearancePrefs = {
  zoneThemes: ChatZoneThemes;
  headingTheme: ChatThemeId;
  accentPreset: ChatAccentPreset;
  density: ChatDensity;
  fontScale: ChatFontScale;
  sidebarSections: ChatSidebarSections;
};

/** @deprecated v1 field — migrated to zoneThemes on read */
export type LegacyChatAppearancePrefs = ChatAppearancePrefs & { themeId?: ChatThemeId };

export type ChatNotificationPrefs = {
  mentions: boolean;
  dms: boolean;
  threads: boolean;
  calls: boolean;
  channelMessages: boolean;
  desktopAlerts: boolean;
  soundEnabled: boolean;
  soundPreset: ChatSoundPreset;
  keywordWatch: string[];
  topicWatch: string[];
};

export type ChatBehaviorPrefs = {
  enterToSend: boolean;
  showLinkPreviews: boolean;
  showTypingIndicators: boolean;
  collapseThreadsByDefault: boolean;
  noiseCancellationStrength: number;
};

export type ChatSavedPreset = {
  id: string;
  name: string;
  snapshot: Omit<ChatUserPreferences, "savedPresets" | "activePresetId">;
};

export type ChatUserPreferences = {
  version: number;
  activePresetId: ChatBuiltinPresetId | string;
  profile: ChatProfilePrefs;
  appearance: ChatAppearancePrefs;
  notifications: ChatNotificationPrefs;
  behavior: ChatBehaviorPrefs;
  savedPresets: ChatSavedPreset[];
};

export type ChatPreferencesPatch = Partial<{
  activePresetId: ChatBuiltinPresetId | string;
  profile: Partial<ChatProfilePrefs>;
  appearance: Partial<ChatAppearancePrefs> & {
    sidebarSections?: Partial<ChatSidebarSections>;
    zoneThemes?: Partial<ChatZoneThemes>;
  };
  notifications: Partial<ChatNotificationPrefs>;
  behavior: Partial<ChatBehaviorPrefs>;
  savedPresets: ChatSavedPreset[];
}>;

export type ChatAlertItem = {
  id: string;
  messageId: number;
  channelId: number;
  channelLabel: string;
  bodyPreview: string;
  reason: "keyword" | "topic" | "dm" | "channel" | "mention" | "thread" | "call";
  createdAt: string;
};

const THEME_IDS: ChatThemeId[] = ["light", "dark", "midnight", "high-contrast", "brand"];

export function isChatThemeId(value: string): value is ChatThemeId {
  return (THEME_IDS as string[]).includes(value);
}

export function defaultZoneThemes(theme: ChatThemeId = "light"): ChatZoneThemes {
  return { left: theme, main: theme, right: theme };
}

export function defaultAppearance(): ChatAppearancePrefs {
  return {
    zoneThemes: defaultZoneThemes("light"),
    headingTheme: "light",
    accentPreset: "brand",
    density: "comfortable",
    fontScale: "default",
    sidebarSections: {
      channels: true,
      dms: true,
      mentions: true,
      alerts: false,
    },
  };
}

export function normalizeAppearance(raw: LegacyChatAppearancePrefs): ChatAppearancePrefs {
  const legacyTheme =
    raw.themeId && isChatThemeId(raw.themeId) ? raw.themeId : undefined;
  const zoneThemes = raw.zoneThemes
    ? {
        left: isChatThemeId(raw.zoneThemes.left) ? raw.zoneThemes.left : "light",
        main: isChatThemeId(raw.zoneThemes.main) ? raw.zoneThemes.main : "light",
        right: isChatThemeId(raw.zoneThemes.right) ? raw.zoneThemes.right : "light",
      }
    : defaultZoneThemes(legacyTheme ?? "light");
  const headingTheme =
    raw.headingTheme && isChatThemeId(raw.headingTheme)
      ? raw.headingTheme
      : legacyTheme ?? "light";
  return {
    zoneThemes,
    headingTheme,
    accentPreset: raw.accentPreset ?? "brand",
    density: raw.density ?? "comfortable",
    fontScale: raw.fontScale ?? "default",
    sidebarSections: {
      channels: raw.sidebarSections?.channels ?? true,
      dms: raw.sidebarSections?.dms ?? true,
      mentions: raw.sidebarSections?.mentions ?? true,
      alerts: raw.sidebarSections?.alerts ?? false,
    },
  };
}

export function normalizeChatPreferences(raw: Partial<ChatUserPreferences> & { appearance?: LegacyChatAppearancePrefs }): ChatUserPreferences {
  const base = defaultChatPreferences();
  const rawAppearance = raw.appearance ?? {};
  const isV2 =
    (raw.version ?? 1) >= 2 &&
    rawAppearance.zoneThemes != null &&
    rawAppearance.headingTheme != null;
  const appearance = isV2
    ? normalizeAppearance({ ...base.appearance, ...rawAppearance })
    : normalizeAppearance({
        accentPreset: rawAppearance.accentPreset ?? base.appearance.accentPreset,
        density: rawAppearance.density ?? base.appearance.density,
        fontScale: rawAppearance.fontScale ?? base.appearance.fontScale,
        sidebarSections: {
          ...base.appearance.sidebarSections,
          ...rawAppearance.sidebarSections,
        },
        themeId: rawAppearance.themeId,
        zoneThemes: rawAppearance.zoneThemes,
        headingTheme: rawAppearance.headingTheme,
      });
  return {
    ...base,
    ...raw,
    profile: { ...base.profile, ...raw.profile },
    appearance,
    notifications: { ...base.notifications, ...raw.notifications },
    behavior: {
      ...base.behavior,
      ...raw.behavior,
      noiseCancellationStrength: clampNoiseCancellationStrength(
        raw.behavior?.noiseCancellationStrength ?? base.behavior.noiseCancellationStrength,
      ),
    },
    savedPresets: raw.savedPresets ?? base.savedPresets,
    version: 2,
  };
}

export function defaultChatPreferences(displayName = "", avatarUrl: string | null = null): ChatUserPreferences {
  return {
    version: 2,
    activePresetId: "balanced",
    profile: {
      displayName,
      avatarUrl,
      statusText: "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    },
    appearance: defaultAppearance(),
    notifications: {
      mentions: true,
      dms: true,
      threads: true,
      calls: true,
      channelMessages: false,
      desktopAlerts: false,
      soundEnabled: false,
      soundPreset: "subtle",
      keywordWatch: [],
      topicWatch: [],
    },
    behavior: {
      enterToSend: true,
      showLinkPreviews: true,
      showTypingIndicators: true,
      collapseThreadsByDefault: false,
      noiseCancellationStrength: 75,
    },
    savedPresets: [],
  };
}

export function mergeChatPreferences(
  base: ChatUserPreferences,
  patch: ChatPreferencesPatch,
): ChatUserPreferences {
  return normalizeChatPreferences({
    ...base,
    ...patch,
    profile: { ...base.profile, ...patch.profile },
    appearance: {
      ...base.appearance,
      ...patch.appearance,
      zoneThemes: patch.appearance?.zoneThemes
        ? { ...base.appearance.zoneThemes, ...patch.appearance.zoneThemes }
        : base.appearance.zoneThemes,
      sidebarSections: {
        ...base.appearance.sidebarSections,
        ...patch.appearance?.sidebarSections,
      },
    },
    notifications: { ...base.notifications, ...patch.notifications },
    behavior: { ...base.behavior, ...patch.behavior },
    savedPresets: patch.savedPresets ?? base.savedPresets,
  });
}

export function prefsLocalStorageKey(teamId: number): string {
  return `flowbie.chat.prefs.${teamId}`;
}

export function stripHtmlToPlain(html: string): string {
  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = html;
    return (el.textContent ?? el.innerText ?? "").trim();
  }
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function messageMatchesKeywords(bodyPlain: string, keywords: string[]): string | null {
  const text = bodyPlain.toLowerCase();
  for (const kw of keywords) {
    const term = kw.trim().toLowerCase();
    if (term && text.includes(term)) return term;
  }
  return null;
}

export function messageMatchesTopics(
  bodyPlain: string,
  channelTopic: string | null | undefined,
  topicWatch: string[],
): string | null {
  const haystack = `${bodyPlain} ${channelTopic ?? ""}`.toLowerCase();
  for (const topic of topicWatch) {
    const term = topic.trim().toLowerCase();
    if (term && haystack.includes(term)) return term;
  }
  return null;
}
