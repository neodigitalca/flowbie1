export type ChatMentionInboxItem = {
  id: number;
  messageId: number;
  channelId: number;
  threadRootId: number | null;
  authorDisplayName: string;
  channelLabel: string;
  preview: string;
  createdAt: string;
  readAt: string | null;
};

export type ChatChannelType = "public" | "private" | "dm";

export type ChatChannel = {
  id: number;
  teamId: number;
  type: ChatChannelType;
  name: string;
  slug: string | null;
  topic?: string | null;
  dmUserId: number | null;
  createdBy: number;
  createdAt: string;
  unreadCount: number;
  threadUnreadCount?: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
};

export type ChatLinkPreview = {
  id: number;
  url: string;
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  siteName?: string | null;
};

export type ChatAttachment = {
  id: number;
  fileName: string;
  mime: string;
  bytes: number;
  url: string;
};

export type ThreadUnreadSummary = {
  threadRootId: number;
  unreadCount: number;
  lastReplyAt: string | null;
};

export type ChatMessage = {
  id: number;
  channelId: number;
  userId: number;
  displayName: string;
  avatarUrl?: string | null;
  bodyHtml: string;
  bodyPlain: string;
  parentMessageId: number | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  linkPreviews?: ChatLinkPreview[];
  attachments?: ChatAttachment[];
  threadReplyCount?: number;
  threadLastReplyAt?: string | null;
  threadUnreadCount?: number;
};

export type ChatMessagesResponse = {
  messages: ChatMessage[];
  threadsUnread?: ThreadUnreadSummary[];
  typingUsers?: { userId: number; displayName: string }[];
};
