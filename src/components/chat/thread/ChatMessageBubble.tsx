import React from "react";
import { MessageSquare, MoreHorizontal, Pencil, SpellCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FloAvatar, isFloDisplayName } from "@/components/chat/FloAvatar";
import { cn } from "@/lib/utils";
import { chatFileDownloadUrl } from "@/lib/chat-api";
import type { ChatMessage } from "@/lib/chat-types";
import { ChatAttachmentChip } from "@/components/chat/thread/ChatAttachmentChip";
import { ChatLinkPreviewCard } from "@/components/chat/thread/ChatLinkPreviewCard";
import { CHAT_MESSAGE_PROSE_CLASS, CHAT_ROW_HOVER, CHAT_TEXT_MUTED, CHAT_TEXT_PRIMARY, CHAT_ICON_BTN_CLASS } from "@/components/chat/chat-theme";

const messageBodyClass = cn(
  CHAT_MESSAGE_PROSE_CLASS,
  "[&_a]:break-all [&_a]:text-[hsl(var(--chat-accent))] [&_a]:underline [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4",
  "[&_[data-type=mention]]:font-semibold [&_[data-type=mention]]:text-[hsl(var(--chat-accent))]",
);

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  return (name.slice(0, 2) || "?").toUpperCase();
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return "";
  }
}

export type ChatMessageBubbleProps = {
  message: ChatMessage;
  teamId: number;
  isOwn: boolean;
  canWrite: boolean;
  isTeamAdmin?: boolean;
  compact?: boolean;
  highlighted?: boolean;
  inThread?: boolean;
  isThreadRoot?: boolean;
  threadSummary?: { label: string; unread: boolean; hasReplies: boolean };
  onEdit?: (message: ChatMessage) => void;
  onDelete?: (message: ChatMessage) => void;
  onAiCorrect?: (message: ChatMessage) => void;
  onReplyInThread?: (message: ChatMessage) => void;
};

export function ChatMessageBubble({
  message,
  teamId,
  isOwn,
  canWrite,
  isTeamAdmin,
  compact,
  highlighted,
  inThread,
  isThreadRoot,
  threadSummary,
  onEdit,
  onDelete,
  onAiCorrect,
  onReplyInThread,
}: ChatMessageBubbleProps): React.ReactElement {
  const canManage = canWrite && (isOwn || isTeamAdmin);
  const showMenu = canManage || (canWrite && !inThread);
  const previews = message.linkPreviews ?? [];
  const attachments = message.attachments ?? [];

  return (
    <div
      id={`chat-msg-${message.id}`}
      className={cn(
        "group flex gap-2 px-5 py-1 transition-colors duration-700",
        CHAT_ROW_HOVER,
        highlighted && "bg-primary/15 ring-2 ring-primary/40 ring-inset",
        threadSummary?.hasReplies && "border-l-2 border-primary/30 pl-3",
      )}
    >
      {compact ? (
        <div className="w-9 shrink-0" aria-hidden />
      ) : isFloDisplayName(message.displayName) ? (
        <FloAvatar avatarUrl={message.avatarUrl} displayName={message.displayName} className="mt-0.5" />
      ) : (
        <Avatar className="mt-0.5 h-9 w-9 shrink-0">
          {message.avatarUrl ? <AvatarImage src={message.avatarUrl} alt={message.displayName} /> : null}
          <AvatarFallback className="bg-primary/20 text-base font-semibold chat-text-primary">
            {initials(message.displayName)}
          </AvatarFallback>
        </Avatar>
      )}
      <div className="min-w-0 flex-1 py-0.5">
        {isThreadRoot ? (
          <span className={cn("mb-1 inline-block rounded-full bg-primary/15 px-2 py-0.5 text-base font-semibold text-primary")}>
            Thread starter
          </span>
        ) : null}
        {!compact ? (
          <div className="flex flex-wrap items-baseline gap-2">
            <span className={cn("text-base font-bold", CHAT_TEXT_PRIMARY)}>{message.displayName}</span>
            <span className={cn("text-base", CHAT_TEXT_MUTED)}>{formatTime(message.createdAt)}</span>
            {message.editedAt ? <span className={cn("text-base", CHAT_TEXT_MUTED)}>(edited)</span> : null}
          </div>
        ) : null}
        {message.bodyHtml ? (
          <div className={messageBodyClass} dangerouslySetInnerHTML={{ __html: message.bodyHtml }} />
        ) : null}
        {previews.map((preview) => (
          <ChatLinkPreviewCard key={preview.id} preview={preview} />
        ))}
        {attachments.map((attachment) => (
          <ChatAttachmentChip
            key={attachment.id}
            attachment={attachment}
            downloadUrl={chatFileDownloadUrl(teamId, message.channelId, attachment.id)}
            inlineUrl={chatFileDownloadUrl(teamId, message.channelId, attachment.id, true)}
          />
        ))}
        {threadSummary && !inThread ? (
          <button
            type="button"
            onClick={() => onReplyInThread?.(message)}
            className={cn(
              "mt-1 inline-flex items-center gap-2 rounded-full px-3 py-1 text-base chat-row-hover",
              threadSummary.hasReplies
                ? threadSummary.unread
                  ? "font-bold text-[hsl(var(--chat-accent))]"
                  : "text-[hsl(var(--chat-accent))]"
                : CHAT_TEXT_MUTED,
            )}
          >
            <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
            {threadSummary.unread ? <span className="h-2 w-2 rounded-full bg-primary" aria-hidden /> : null}
            {threadSummary.label}
          </button>
        ) : null}
      </div>
      {showMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100", CHAT_ICON_BTN_CLASS)}
              aria-label="Message options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-base">
            {canWrite && !inThread ? (
              <DropdownMenuItem className="text-base gap-2" onClick={() => onReplyInThread?.(message)}>
                <MessageSquare className="h-4 w-4" />
                Reply in thread
              </DropdownMenuItem>
            ) : null}
            {isOwn ? (
              <>
                <DropdownMenuItem className="text-base gap-2" onClick={() => onEdit?.(message)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem className="text-base gap-2" onClick={() => onAiCorrect?.(message)}>
                  <SpellCheck className="h-4 w-4" />
                  AI Correct
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            {canManage ? (
              <DropdownMenuItem
                className="text-base gap-2 text-red-600 focus:text-red-600"
                onClick={() => onDelete?.(message)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
