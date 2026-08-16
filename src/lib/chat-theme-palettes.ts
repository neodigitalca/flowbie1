import type { CSSProperties } from "react";
import type { ChatAccentPreset, ChatAppearancePrefs, ChatThemeId } from "@/lib/chat-preferences-types";

export type ChatThemeTokens = {
  bg: string;
  sidebarBg: string;
  barBg: string;
  composerBg: string;
  text: string;
  muted: string;
  border: string;
  rowHover: string;
  headingText: string;
  sectionLabelText: string;
};

export const CHAT_THEME_PALETTES: Record<ChatThemeId, ChatThemeTokens> = {
  light: {
    bg: "0 0% 100%",
    sidebarBg: "240 5% 96%",
    barBg: "0 0% 100%",
    composerBg: "240 5% 98%",
    text: "240 6% 10%",
    muted: "240 4% 46%",
    border: "240 6% 90%",
    rowHover: "240 5% 98%",
    headingText: "240 6% 10%",
    sectionLabelText: "240 4% 46%",
  },
  dark: {
    bg: "240 6% 10%",
    sidebarBg: "240 5% 8%",
    barBg: "240 6% 12%",
    composerBg: "240 5% 8%",
    text: "0 0% 100%",
    muted: "0 0% 92%",
    border: "240 4% 20%",
    rowHover: "240 5% 14%",
    headingText: "0 0% 100%",
    sectionLabelText: "0 0% 92%",
  },
  midnight: {
    bg: "222 47% 6%",
    sidebarBg: "222 47% 4%",
    barBg: "222 47% 8%",
    composerBg: "222 47% 5%",
    text: "0 0% 100%",
    muted: "0 0% 92%",
    border: "217 33% 17%",
    rowHover: "217 33% 12%",
    headingText: "0 0% 100%",
    sectionLabelText: "0 0% 92%",
  },
  "high-contrast": {
    bg: "0 0% 0%",
    sidebarBg: "0 0% 5%",
    barBg: "0 0% 0%",
    composerBg: "0 0% 8%",
    text: "0 0% 100%",
    muted: "0 0% 92%",
    border: "0 0% 40%",
    rowHover: "0 0% 12%",
    headingText: "0 0% 100%",
    sectionLabelText: "0 0% 92%",
  },
  brand: {
    bg: "84 20% 97%",
    sidebarBg: "84 25% 94%",
    barBg: "84 20% 98%",
    composerBg: "84 18% 95%",
    text: "84 30% 12%",
    muted: "84 15% 35%",
    border: "84 20% 85%",
    rowHover: "84 25% 92%",
    headingText: "84 40% 18%",
    sectionLabelText: "84 25% 28%",
  },
  slack: {
    bg: "220 9% 11%",
    sidebarBg: "300 61% 13%",
    barBg: "220 9% 11%",
    composerBg: "220 7% 15%",
    text: "0 0% 100%",
    muted: "220 5% 65%",
    border: "300 30% 22%",
    rowHover: "300 45% 20%",
    headingText: "0 0% 100%",
    sectionLabelText: "220 5% 75%",
  },
};

const ACCENT_TOKENS: Record<ChatAccentPreset, { accent: string; accentSoft: string }> = {
  brand: { accent: "var(--primary)", accentSoft: "84 81% 44% / 0.15" },
  blue: { accent: "217 91% 60%", accentSoft: "217 91% 60% / 0.15" },
  violet: { accent: "262 83% 58%", accentSoft: "262 83% 58% / 0.15" },
  rose: { accent: "350 89% 60%", accentSoft: "350 89% 60% / 0.15" },
  amber: { accent: "38 92% 50%", accentSoft: "38 92% 50% / 0.15" },
};

function tokensToZoneStyle(tokens: ChatThemeTokens, accent: ChatAccentPreset): CSSProperties {
  const accentTokens = ACCENT_TOKENS[accent];
  return {
    ["--chat-bg" as string]: tokens.bg,
    ["--chat-sidebar-bg" as string]: tokens.sidebarBg,
    ["--chat-bar-bg" as string]: tokens.barBg,
    ["--chat-composer-bg" as string]: tokens.composerBg,
    ["--chat-text" as string]: tokens.text,
    ["--chat-muted" as string]: tokens.muted,
    ["--chat-border" as string]: tokens.border,
    ["--chat-row-hover" as string]: tokens.rowHover,
    ["--chat-row-active-bg" as string]: accentTokens.accentSoft,
    ["--chat-heading-text" as string]: tokens.headingText,
    ["--chat-section-label-text" as string]: tokens.sectionLabelText,
  };
}

export function zoneThemeStyle(themeId: ChatThemeId, accentPreset: ChatAccentPreset): CSSProperties {
  return tokensToZoneStyle(CHAT_THEME_PALETTES[themeId], accentPreset);
}

export function headingThemeStyle(headingTheme: ChatThemeId, accentPreset: ChatAccentPreset): CSSProperties {
  const tokens = CHAT_THEME_PALETTES[headingTheme];
  const accent = ACCENT_TOKENS[accentPreset];
  return {
    ["--chat-heading-text" as string]: tokens.headingText,
    ["--chat-section-label-text" as string]: tokens.sectionLabelText,
    ["--chat-accent" as string]: accent.accent,
  };
}

export function chatRootDataAttrs(appearance: ChatAppearancePrefs): Record<string, string> {
  return {
    "data-chat-accent": appearance.accentPreset,
    "data-chat-density": appearance.density,
    "data-chat-font": appearance.fontScale,
    "data-heading-theme": appearance.headingTheme,
    "data-chat-layout": appearance.layoutMode,
  };
}

export function chatZoneClassName(): string {
  return "chat-zone min-h-0 min-w-0";
}

export function chatZoneProps(
  themeId: ChatThemeId,
  accentPreset: ChatAccentPreset,
  extraClass?: string,
): { className: string; style: CSSProperties; "data-zone-theme": ChatThemeId } {
  return {
    className: `${chatZoneClassName()} ${extraClass ?? ""}`.trim(),
    style: zoneThemeStyle(themeId, accentPreset),
    "data-zone-theme": themeId,
  };
}

export function themePreviewStyle(themeId: ChatThemeId): CSSProperties {
  const t = CHAT_THEME_PALETTES[themeId];
  return {
    backgroundColor: `hsl(${t.bg})`,
    color: `hsl(${t.text})`,
  };
}

export function themePreviewMutedStyle(themeId: ChatThemeId): CSSProperties {
  const t = CHAT_THEME_PALETTES[themeId];
  return { color: `hsl(${t.muted})` };
}
