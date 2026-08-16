import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Link2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchChatActivityLog } from "@/lib/chat-api";
import {
  activityLabel,
  chatMessageHash,
  isFileActivity,
  isLinkActivity,
  type ChatActivityLogEntry,
} from "@/lib/chat-activity-log";
import type { TeamMember } from "@/lib/teams-types";
import { CHAT_TEXT_MUTED, CHAT_TEXT_PRIMARY } from "@/components/chat/chat-theme";
import { cn } from "@/lib/utils";

type SharedTab = "all" | "links" | "files";

export type ChatSharedDrawerProps = {
  open: boolean;
  teamId: number;
  channelId: number;
  members: TeamMember[];
  onClose: () => void;
  onJumpToMessage: (messageId: number) => void;
};

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function ChatSharedDrawer({
  open,
  teamId,
  channelId,
  members,
  onClose,
  onJumpToMessage,
}: ChatSharedDrawerProps): React.ReactElement | null {
  const [tab, setTab] = useState<SharedTab>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [items, setItems] = useState<ChatActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const memberNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of members) map.set(m.userId, m.displayName);
    return map;
  }, [members]);

  const loadLog = useCallback(async () => {
    if (!open || !teamId || !channelId) return;
    setLoading(true);
    try {
      const list = await fetchChatActivityLog(teamId, channelId, {
        limit: 100,
        userId: userFilter !== "all" ? Number(userFilter) : undefined,
      });
      setItems(list);
    } finally {
      setLoading(false);
    }
  }, [open, teamId, channelId, userFilter]);

  useEffect(() => {
    void loadLog();
  }, [loadLog]);

  const filtered = useMemo(() => {
    return items.filter((entry) => {
      if (entry.kind === "file_removed" || entry.kind === "link_removed") return false;
      if (tab === "links") return isLinkActivity(entry);
      if (tab === "files") return isFileActivity(entry);
      return true;
    });
  }, [items, tab]);

  if (!open) return null;

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-zinc-200 bg-zinc-50">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className={cn("text-base font-bold", CHAT_TEXT_PRIMARY)}>Shared</h3>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close shared panel">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex gap-1 px-4 pb-2">
        {(["all", "links", "files"] as SharedTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full px-3 py-1 text-base capitalize",
              tab === t ? "bg-primary/20 font-semibold text-zinc-900" : "text-zinc-600 hover:bg-zinc-200/80",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="px-4 pb-3">
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="text-base">
            <SelectValue placeholder="All members" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-base">All members</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.userId} value={String(m.userId)} className="text-base">
                {m.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {loading && items.length === 0 ? (
          <div className={cn("flex items-center justify-center py-8 text-base", CHAT_TEXT_MUTED)}>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading
          </div>
        ) : null}
        {!loading && filtered.length === 0 ? (
          <p className={cn("px-2 py-8 text-center text-base", CHAT_TEXT_MUTED)}>No shared links or files yet.</p>
        ) : null}
        {filtered.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => {
              window.location.hash = chatMessageHash(entry.messageId);
              onJumpToMessage(entry.messageId);
            }}
            className="mb-1 flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-zinc-200/60"
          >
            {isLinkActivity(entry) ? (
              <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            ) : (
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            )}
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate text-base font-medium", CHAT_TEXT_PRIMARY)}>{activityLabel(entry)}</span>
              <span className={cn("block text-base", CHAT_TEXT_MUTED)}>
                {memberNameById.get(entry.userId) ?? "Unknown"} · {formatTime(entry.ts || entry.createdAt)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
