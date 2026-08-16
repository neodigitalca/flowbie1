import "@/components/chat/chat-theme-vars.css";
import { cn } from "@/lib/utils";
import { chatRootDataAttrs as paletteRootDataAttrs } from "@/lib/chat-theme-palettes";
import type { ChatAppearancePrefs } from "@/lib/chat-preferences-types";

export const CHAT_SIDEBAR_CLASS =
  "chat-sidebar flex w-full min-w-0 flex-col";
export const CHAT_MAIN_CLASS = "chat-main flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden";
export const CHAT_CHANNEL_BAR_CLASS =
  "chat-bar flex shrink-0 items-center gap-2 border-b px-4";
export const CHAT_SCROLL_CLASS = "chat-scroll flex min-h-0 flex-1 flex-col overflow-y-auto";
export const CHAT_SURFACE_CLASS = "chat-surface";
export const CHAT_SURFACE_ELEVATED_CLASS = "chat-surface-elevated";
export const CHAT_BORDER_CLASS = "chat-border border-[hsl(var(--chat-border))]";
export const CHAT_CHIP_CLASS = "chat-chip rounded-lg";
export const CHAT_ICON_BTN_CLASS = "chat-icon-btn";
export const CHAT_EDITOR_ROOT_CLASS = "chat-editor-root flex flex-col";
export const CHAT_EDITOR_TOOLBAR_CLASS = "chat-editor-toolbar flex min-w-0 flex-nowrap items-center gap-0.5 overflow-x-auto border-b px-2 py-1";
export const CHAT_ACCENT_PILL_CLASS = "chat-accent-pill";
export const CHAT_EDITOR_CONTENT_CLASS =
  "chat-editor-content min-h-[6rem] max-h-64 overflow-y-auto px-3 py-2 text-base outline-none [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[hsl(var(--chat-accent))] [&_a]:underline [&_[data-type=mention]]:chat-accent-pill";
export const CHAT_MESSAGE_PROSE_CLASS =
  "chat-message-prose prose max-w-none text-base leading-relaxed [&_p]:text-inherit [&_span]:text-inherit [&_div]:text-inherit [&_li]:text-inherit [&_code]:rounded [&_code]:px-1 [&_blockquote]:border-l-2 [&_blockquote]:pl-3";
export const CHAT_RIGHT_RAIL_THEMED_CLASS =
  "chat-right-rail flex h-full min-h-0 w-full min-w-0 flex-col";
export const CHAT_INPUT_THEMED_CLASS = "chat-input-themed h-8 text-base";
export const CHAT_TAB_ACTIVE_CLASS = "chat-tab-active";
export const CHAT_TAB_IDLE_CLASS = "chat-tab-idle";
export const CHAT_DAY_PILL_CLASS = "chat-day-pill rounded-full border px-3 py-1 text-base font-semibold shadow-sm";

export const CHAT_RIGHT_RAIL_CLASS = CHAT_RIGHT_RAIL_THEMED_CLASS;
export const CHAT_COMPOSER_WRAP_CLASS = "chat-composer-wrap shrink-0 border-t px-4 py-3";
export const CHAT_COMPOSER_BOX_CLASS =
  "relative overflow-hidden rounded-md border border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-bg))] pl-10 shadow-sm";

export const CHAT_TEXT_PRIMARY = "chat-text-primary";
export const CHAT_TEXT_MUTED = "chat-text-muted";
export const CHAT_HEADING_TEXT = "chat-heading-text";
export const CHAT_ROW_HOVER = "chat-row hover:bg-[hsl(var(--chat-row-hover))]";
export const CHAT_LINK = "text-[hsl(var(--chat-accent))] [&_a]:text-[hsl(var(--chat-accent))]";

export const CHAT_SIDEBAR_SECTION_LABEL = "chat-section-label text-base font-semibold";
export const CHAT_SIDEBAR_ROW =
  "chat-row chat-text-primary flex w-full items-center gap-2 rounded-md px-2 text-left text-base transition-colors";
export const CHAT_SIDEBAR_ROW_ACTIVE = "chat-row-active font-semibold ring-1 ring-inset ring-[hsl(var(--chat-accent)/0.25)]";
export const CHAT_CHANNEL_TITLE_CLASS = "chat-heading-text shrink-0 text-base font-bold";

export const CHAT_UNREAD_BADGE = "chat-unread-badge rounded-full px-2 py-0.5 text-base font-semibold";

export function chatRootDataAttrs(appearance: ChatAppearancePrefs): Record<string, string> {
  return paletteRootDataAttrs(appearance);
}

export function chatThemedRootClass(extra?: string): string {
  return cn(
    "chat-themed flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden font-sans",
    extra,
  );
}

/** @deprecated use chatRootDataAttrs */
export function chatThemeDataAttrs(prefs: { appearance: ChatAppearancePrefs }): Record<string, string> {
  return chatRootDataAttrs(prefs.appearance);
}
