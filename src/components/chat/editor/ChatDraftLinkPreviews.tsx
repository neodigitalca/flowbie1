import React, { useEffect, useRef, useState } from "react";
import { previewChatLink } from "@/lib/chat-api";
import { extractUrlsFromHtml } from "@/lib/chat-link-utils";
import type { ChatLinkPreview } from "@/lib/chat-types";
import { ChatLinkPreviewCard } from "@/components/chat/thread/ChatLinkPreviewCard";
import { CHAT_COMPOSER_WRAP_CLASS } from "@/components/chat/chat-theme";
import { cn } from "@/lib/utils";

const previewCache = new Map<string, ChatLinkPreview>();

function domainFallback(url: string): ChatLinkPreview {
  let siteName = url;
  try {
    siteName = new URL(url).hostname;
  } catch {
    // keep url
  }
  return { id: 0, url, siteName };
}

export type ChatDraftLinkPreviewsProps = {
  teamId: number | null;
  html: string;
  className?: string;
};

export function ChatDraftLinkPreviews({ teamId, html, className }: ChatDraftLinkPreviewsProps): React.ReactElement | null {
  const [previews, setPreviews] = useState<ChatLinkPreview[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const urls = extractUrlsFromHtml(html);
    if (!teamId || urls.length === 0) {
      setPreviews([]);
      return;
    }

    setPreviews(urls.map((url) => previewCache.get(url) ?? domainFallback(url)));

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timer = window.setTimeout(() => {
      void (async () => {
        const next: ChatLinkPreview[] = [];
        for (const url of urls) {
          if (controller.signal.aborted) return;
          const cached = previewCache.get(url);
          if (cached && cached.title) {
            next.push(cached);
            continue;
          }
          const result = await previewChatLink(teamId, url, controller.signal);
          if (controller.signal.aborted) return;
          if (result.ok && result.preview) {
            previewCache.set(url, result.preview);
            next.push(result.preview);
          } else {
            const fallback = domainFallback(url);
            previewCache.set(url, fallback);
            next.push(fallback);
          }
        }
        if (!controller.signal.aborted) setPreviews(next);
      })();
    }, 500);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [teamId, html]);

  if (previews.length === 0) return null;

  return (
    <div className={cn("chat-composer-wrap border-t px-3 py-2", className)}>
      {previews.map((preview) => (
        <ChatLinkPreviewCard key={preview.url} preview={preview} />
      ))}
    </div>
  );
}
