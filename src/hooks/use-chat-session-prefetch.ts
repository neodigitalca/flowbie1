import { useEffect } from "react";
import { prefetchChatSession } from "@/lib/chat-session-cache";

export function useChatSessionPrefetch(teamId: number | null): void {
  useEffect(() => {
    if (!teamId) return;
    void prefetchChatSession(teamId);
  }, [teamId]);
}
