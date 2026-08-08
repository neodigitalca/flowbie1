import React, { useMemo, useState } from "react";
import { Hash, Lock, MessageCircle, Plus, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatChannel, ChatMentionInboxItem } from "@/lib/chat-types";
import { ChannelCreateDialog } from "@/components/chat/sidebar/ChannelCreateDialog";
import { DmMemberPicker } from "@/components/chat/sidebar/DmMemberPicker";
import { ChatMentionsList } from "@/components/chat/sidebar/ChatMentionsList";
import { ChatAlertsList } from "@/components/chat/sidebar/ChatAlertsList";
import type { ChatAlertItem, ChatSidebarSections, ChatThemeId } from "@/lib/chat-preferences-types";
import type { ActiveHuddleSummary } from "@/lib/chat-call-types";
import {
  CHAT_SIDEBAR_CLASS,
  CHAT_SIDEBAR_ROW,
  CHAT_SIDEBAR_ROW_ACTIVE,
  CHAT_SIDEBAR_SECTION_LABEL,
  CHAT_UNREAD_BADGE,
  CHAT_TEXT_MUTED,
  CHAT_ICON_BTN_CLASS,
} from "@/components/chat/chat-theme";

function channelIcon(type: ChatChannel["type"]) {
  if (type === "private") return Lock;
  if (type === "dm") return MessageCircle;
  return Hash;
}

export type ChatSidebarProps = {
  channels: ChatChannel[];
  activeChannelId: number | null;
  canWrite: boolean;
  onSelectChannel: (channelId: number) => void;
  onChannelCreated: (channel: ChatChannel) => void;
  onDmOpened: (channel: ChatChannel) => void;
  mentions: ChatMentionInboxItem[];
  mentionUnreadCount: number;
  activeMentionMessageId: number | null;
  onOpenMention: (item: ChatMentionInboxItem) => void;
  alerts?: ChatAlertItem[];
  activeAlertId?: string | null;
  onOpenAlert?: (alert: ChatAlertItem) => void;
  onDismissAlert?: (alertId: string) => void;
  sidebarSections: ChatSidebarSections;
  activeHuddles?: ActiveHuddleSummary[];
  zoneClassName?: string;
  zoneStyle?: React.CSSProperties;
  zoneTheme?: ChatThemeId;
};

export function ChatSidebar({
  channels,
  activeChannelId,
  canWrite,
  onSelectChannel,
  onChannelCreated,
  onDmOpened,
  mentions,
  mentionUnreadCount,
  activeMentionMessageId,
  onOpenMention,
  alerts = [],
  activeAlertId = null,
  onOpenAlert,
  onDismissAlert,
  sidebarSections,
  activeHuddles = [],
  zoneClassName,
  zoneStyle,
  zoneTheme,
}: ChatSidebarProps): React.ReactElement {
  const [createOpen, setCreateOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);

  const publicChannels = channels.filter((c) => c.type === "public" || c.type === "private");
  const dms = channels.filter((c) => c.type === "dm");

  const huddleByChannel = useMemo(() => {
    const map = new Map<number, ActiveHuddleSummary>();
    for (const h of activeHuddles) map.set(h.channelId, h);
    return map;
  }, [activeHuddles]);

  const renderRow = (channel: ChatChannel) => {
    const Icon = channelIcon(channel.type);
    const active = channel.id === activeChannelId;
    const huddle = huddleByChannel.get(channel.id);
    const label =
      channel.type === "public" || channel.type === "private"
        ? channel.slug ?? channel.name
        : channel.name;
    return (
      <button
        key={channel.id}
        type="button"
        onClick={() => onSelectChannel(channel.id)}
        className={cn(CHAT_SIDEBAR_ROW, active && CHAT_SIDEBAR_ROW_ACTIVE)}
      >
        <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[hsl(var(--chat-accent))]" : CHAT_TEXT_MUTED)} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {huddle ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-lime-500/20 px-2 py-0.5 text-base text-lime-400">
            <Radio className="h-3 w-3" />
            {huddle.participantCount}
          </span>
        ) : null}
        {(channel.unreadCount ?? 0) + (channel.threadUnreadCount ?? 0) > 0 ? (
          <span className={cn("shrink-0", CHAT_UNREAD_BADGE)}>
            {(channel.unreadCount ?? 0) + (channel.threadUnreadCount ?? 0)}
          </span>
        ) : null}
      </button>
    );
  };

  const addBtnClass = cn("h-8 w-8", CHAT_ICON_BTN_CLASS);

  return (
    <aside
      className={cn(CHAT_SIDEBAR_CLASS, "h-full", zoneClassName)}
      style={zoneStyle}
      data-zone-theme={zoneTheme}
    >
      {sidebarSections.channels ? (
        <>
          <div className="flex items-center justify-between px-3 py-3">
            <span className={CHAT_SIDEBAR_SECTION_LABEL}>Channels</span>
            {canWrite ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={addBtnClass}
                aria-label="New channel"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          <div className="px-2 pb-2">{publicChannels.map(renderRow)}</div>
        </>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {sidebarSections.dms ? (
          <>
            <div className="mt-4 flex items-center justify-between px-1 py-2">
              <span className={CHAT_SIDEBAR_SECTION_LABEL}>DMs</span>
              {canWrite ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={addBtnClass}
                  aria-label="New direct message"
                  onClick={() => setDmOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
            {dms.map(renderRow)}
          </>
        ) : null}
        {sidebarSections.mentions ? (
          <ChatMentionsList
            mentions={mentions}
            unreadCount={mentionUnreadCount}
            activeMentionMessageId={activeMentionMessageId}
            onOpenMention={onOpenMention}
          />
        ) : null}
        {sidebarSections.alerts && onOpenAlert && onDismissAlert ? (
          <ChatAlertsList
            alerts={alerts}
            activeAlertId={activeAlertId}
            onOpenAlert={onOpenAlert}
            onDismiss={onDismissAlert}
          />
        ) : null}
      </div>
      <ChannelCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(channel) => {
          onChannelCreated(channel);
          onSelectChannel(channel.id);
        }}
      />
      <DmMemberPicker
        open={dmOpen}
        onOpenChange={setDmOpen}
        onOpened={(channel) => {
          onDmOpened(channel);
          onSelectChannel(channel.id);
        }}
      />
    </aside>
  );
}
