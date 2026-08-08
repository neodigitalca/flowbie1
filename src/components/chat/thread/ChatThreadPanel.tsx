import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/chat-types";
import type { MentionMember } from "@/components/chat/editor/chat-editor-extensions";
import { ChatMessageBubble } from "@/components/chat/thread/ChatMessageBubble";
import { ChatComposer, type ChatComposerHandle } from "@/components/chat/thread/ChatComposer";
import { CHAT_TEXT_MUTED, CHAT_SCROLL_CLASS } from "@/components/chat/chat-theme";
import { cn } from "@/lib/utils";

function repliesDividerLabel(count: number): string {
  if (count === 0) return "No replies yet";
  if (count === 1) return "1 reply";
  return `${count} replies`;
}

export type ChatThreadPanelProps = {
  teamId: number;
  channelId: number;
  threadRoot: ChatMessage;
  members: MentionMember[];
  currentUserId: number;
  canWrite: boolean;
  isTeamAdmin?: boolean;
  loadThread: (rootId: number) => Promise<ChatMessage[]>;
  markThreadRead: (rootId: number, messageId: number) => Promise<void>;
  sendMessage: (html: string, attachmentAssetIds: number[], parentMessageId?: number) => Promise<boolean>;
  pingTyping: () => void;
  sending?: boolean;
  highlightMessageId?: number | null;
  threadSearchQuery?: string;
  onEdit?: (message: ChatMessage) => void;
  onDelete?: (message: ChatMessage) => void;
  onAiCorrect?: (message: ChatMessage) => void;
  composerRef?: React.RefObject<ChatComposerHandle | null>;
};

export function ChatThreadPanel({
  teamId,
  channelId,
  threadRoot,
  members,
  currentUserId,
  canWrite,
  isTeamAdmin,
  loadThread,
  markThreadRead,
  sendMessage,
  pingTyping,
  sending,
  highlightMessageId,
  threadSearchQuery = "",
  onEdit,
  onDelete,
  onAiCorrect,
  composerRef,
}: ChatThreadPanelProps): React.ReactElement {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const list = await loadThread(threadRoot.id);
    setMessages(list);
    const last = list[list.length - 1];
    if (last) await markThreadRead(threadRoot.id, last.id);
  }, [loadThread, markThreadRead, threadRoot.id]);

  useEffect(() => {
    void refresh();
    pollRef.current = window.setInterval(() => void refresh(), 3000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [refresh]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const needle = threadSearchQuery.trim().toLowerCase();

  const { rootMessage, replyMessages, showRoot } = useMemo(() => {
    const enrichedRoot = messages.find((m) => m.id === threadRoot.id) ?? threadRoot;
    const filtered = needle
      ? messages.filter((m) => m.bodyPlain.toLowerCase().includes(needle))
      : messages;
    const replies = filtered.filter((m) => m.id !== threadRoot.id);
    const rootVisible =
      !needle || enrichedRoot.bodyPlain.toLowerCase().includes(needle);
    return {
      rootMessage: enrichedRoot,
      replyMessages: replies,
      showRoot: rootVisible,
    };
  }, [messages, needle, threadRoot]);

  const handleSend = async (html: string, assetIds: number[]) => {
    const ok = await sendMessage(html, assetIds, threadRoot.id);
    if (ok) void refresh();
  };

  const emptySearch = needle && !showRoot && replyMessages.length === 0;

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col chat-scroll")}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {emptySearch ? (
          <p className={cn("px-5 py-12 text-center text-base", CHAT_TEXT_MUTED)}>No replies match your search.</p>
        ) : null}
        {showRoot ? (
          <ChatMessageBubble
            message={rootMessage}
            teamId={teamId}
            isOwn={rootMessage.userId === currentUserId}
            canWrite={canWrite}
            isTeamAdmin={isTeamAdmin}
            highlighted={highlightMessageId === rootMessage.id}
            inThread
            isThreadRoot
            onEdit={onEdit}
            onDelete={onDelete}
            onAiCorrect={onAiCorrect}
          />
        ) : null}
        {!emptySearch ? (
          <div className="flex items-center gap-3 px-5 py-3">
            <span className={cn("shrink-0 text-base font-semibold", CHAT_TEXT_MUTED)}>
              {repliesDividerLabel(replyMessages.length)}
            </span>
            <span className="h-px min-w-0 flex-1 bg-[hsl(var(--chat-border))]" aria-hidden />
          </div>
        ) : null}
        {replyMessages.map((message, idx) => (
          <ChatMessageBubble
            key={message.id}
            message={message}
            teamId={teamId}
            isOwn={message.userId === currentUserId}
            canWrite={canWrite}
            isTeamAdmin={isTeamAdmin}
            compact={idx > 0 && replyMessages[idx - 1]!.userId === message.userId}
            highlighted={highlightMessageId === message.id}
            inThread
            onEdit={onEdit}
            onDelete={onDelete}
            onAiCorrect={onAiCorrect}
          />
        ))}
        <div ref={bottomRef} />
      </div>
      <ChatComposer
        ref={composerRef}
        teamId={teamId}
        channelId={channelId}
        members={members}
        disabled={!canWrite}
        sending={sending}
        onSend={handleSend}
        onTyping={pingTyping}
        placeholder="Reply in thread…"
      />
    </div>
  );
}
