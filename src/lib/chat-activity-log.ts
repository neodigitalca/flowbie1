export type ChatActivityKind = "link_shared" | "file_shared" | "file_removed" | "link_removed";

export type ChatActivityLogEntry = {
  id: number;
  kind: ChatActivityKind;
  channelId: number;
  messageId: number;
  userId: number;
  ts: string;
  createdAt: string;
  url?: string;
  previewId?: number;
  previewTitle?: string;
  assetId?: number;
  fileName?: string;
  mime?: string;
  bytes?: number;
  threadRootMessageId?: number | null;
  channelName?: string;
  sharerDisplayName?: string;
  threadPreviewPlain?: string;
};

export function isLinkActivity(entry: ChatActivityLogEntry): boolean {
  return entry.kind === "link_shared";
}

export function isFileActivity(entry: ChatActivityLogEntry): boolean {
  return entry.kind === "file_shared" || entry.kind === "file_removed";
}

export function activityLabel(entry: ChatActivityLogEntry): string {
  if (entry.kind === "file_shared" || entry.kind === "file_removed") {
    return entry.fileName ?? "File";
  }
  if (entry.url) {
    try {
      return new URL(entry.url).hostname;
    } catch {
      return entry.url;
    }
  }
  return "Link";
}

export function chatMessageHash(messageId: number): string {
  return `#m${messageId}`;
}

export function parseChatMessageHash(hash: string): number | null {
  const m = /^#?m(\d+)$/.exec(hash.trim());
  return m ? Number(m[1]) : null;
}
